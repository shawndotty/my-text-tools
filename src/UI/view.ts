import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { t } from "../lang/helpers";
import { SettingsState, DEFAULT_SETTINGS_STATE, ToolType } from "../types";
import { HistoryManager } from "../utils/historyManager";
import { processText } from "../utils/textProcessors";
import { saveToOriginal, saveToNewFile } from "../utils/fileOperations";
import { renderToolsPanel } from "./components/ToolsPanel";
import {
	renderEditorPanel,
	EditorPanelCallbacks,
} from "./components/EditorPanel";
import {
	renderGlobalSettings,
	renderToolSettings,
	SettingsPanelCallbacks,
} from "./components/SettingsPanel";

export const MY_TEXT_TOOLS_VIEW = "my-text-tools-view";

export class MyTextToolsView extends ItemView {
	content: string = ""; // 存储中间窗口的临时文本内容
	editMode: "source" | "preview" = "source"; // 默认源码模式
	historyManager: HistoryManager = new HistoryManager();
	originalEditor: any = null; // 对原笔记编辑器的引用
	activeTool: ToolType | "" = ""; // 当前选中的工具 ID
	settingsState: SettingsState = { ...DEFAULT_SETTINGS_STATE };

	constructor(leaf: WorkspaceLeaf, originalEditor: any) {
		super(leaf);
		this.originalEditor = originalEditor;
		if (originalEditor) {
			this.content = originalEditor.getValue();
		}
	}

	getViewType() {
		return MY_TEXT_TOOLS_VIEW;
	}
	getDisplayText() {
		return t("WORKBENCH_TITLE");
	}
	getIcon() {
		return "remove-formatting";
	}

	async onOpen() {
		this.render();
		// 在 onOpen 生命周期中加入
		// 撤销 Ctrl+Z
		this.scope?.register(["Mod"], "z", (evt) => {
			this.undo();
			return false;
		});

		// 重做 Ctrl+Y
		this.scope?.register(["Mod"], "y", (evt) => {
			this.redo();
			return false;
		});

		// 重做 Ctrl+Shift+Z (符合部分用户习惯)
		this.scope?.register(["Mod", "Shift"], "z", (evt) => {
			this.redo();
			return false;
		});
	}

	render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("mtt-layout-container");

		// --- 1. 左侧：工具导航栏 ---
		const leftPanel = container.createDiv({ cls: "mtt-left-panel" });
		renderToolsPanel(leftPanel, this.activeTool, (toolId) => {
			this.activeTool = toolId;
			this.render(); // 重新渲染以更新 UI 状态
		});

		// --- 2. 中间：主编辑区域 ---
		const centerPanel = container.createDiv({ cls: "mtt-center-panel" });
		const editorCallbacks: EditorPanelCallbacks = {
			onUndo: () => this.undo(),
			onRedo: () => this.redo(),
			onModeToggle: () => {
				this.editMode =
					this.editMode === "source" ? "preview" : "source";
				this.render();
			},
			onCopy: async () => {
				try {
					await navigator.clipboard.writeText(this.content);
					new Notice(t("NOTICE_COPY_CLIPBOARD_SUCCESS"));
				} catch (err) {
					new Notice(t("NOTICE_COPY_CLIPBOARD_ERROR"));
				}
			},
			onSaveNew: () => this.saveToNewFile(),
			onSaveOriginal: () => this.saveToOriginal(),
			onContentChange: (content: string) => {
				this.content = content;
			},
		};
		renderEditorPanel(
			centerPanel,
			this.content,
			this.editMode,
			this.historyManager.canUndo(),
			this.historyManager.canRedo(),
			!!this.originalEditor,
			editorCallbacks,
			this.app
		);

		// --- 3. 右侧：动态设置区域 ---
		const rightPanel = container.createDiv({ cls: "mtt-right-panel" });
		const settingsCallbacks: SettingsPanelCallbacks = {
			onSettingsChange: (key: string, value: any) => {
				(this.settingsState as any)[key] = value;
			},
			onRun: (toolId: ToolType) => {
				this.processText(toolId);
			},
		};
		renderGlobalSettings(rightPanel, this.settingsState, settingsCallbacks);
		renderToolSettings(
			rightPanel,
			this.activeTool,
			this.settingsState,
			settingsCallbacks
		);
	}

	// 统一处理文本逻辑
	processText(type: ToolType) {
		this.historyManager.pushToHistory(this.content);

		const processedContent = processText(
			type,
			this.content,
			this.settingsState
		);
		this.content = processedContent;

		this.render();
	}

	// 保存回原笔记
	saveToOriginal() {
		saveToOriginal(this.content, this.originalEditor);
	}

	async onClose() {
		// 清理逻辑
		this.historyManager.clear();
	}

	// 撤销逻辑
	undo() {
		const previousContent = this.historyManager.undo(this.content);
		if (previousContent !== null) {
			this.content = previousContent;
			new Notice(t("NOTICE_UNDO"));
			this.render(); // 重新渲染界面
		} else {
			new Notice(t("NOTICE_NO_UNDO"));
		}
	}

	// 重做逻辑
	redo() {
		const nextContent = this.historyManager.redo(this.content);
		if (nextContent !== null) {
			this.content = nextContent;
			this.render();
		} else {
			new Notice(t("NOTICE_NO_REDO"));
		}
	}

	async saveToNewFile() {
		await saveToNewFile(this.app, this.content);
	}
}
