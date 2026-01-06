import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	Editor,
	EditorPosition,
} from "obsidian";
import { t } from "../lang/helpers";
import { SettingsState, DEFAULT_SETTINGS_STATE, ToolType } from "../types";
import { HistoryManager } from "../utils/historyManager";
import { processText } from "../utils/textProcessors";
import { saveToOriginal, saveToNewFile } from "../utils/fileOperations";
import { AIService } from "../utils/aiService";
import MyTextTools from "../main";
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

interface SelectionRange {
	start: EditorPosition;
	end: EditorPosition;
}

export class MyTextToolsView extends ItemView {
	content: string = ""; // 存储中间窗口的临时文本内容
	editMode: "source" | "preview" = "source"; // 默认源码模式
	historyManager: HistoryManager = new HistoryManager();
	originalEditor: Editor | null = null; // 对原笔记编辑器的引用
	selectionRange: SelectionRange | null = null; // 选区范围
	activeTool: ToolType | "" = ""; // 当前选中的工具 ID
	settingsState: SettingsState = { ...DEFAULT_SETTINGS_STATE };
	plugin: MyTextTools; // 插件实例引用

	constructor(leaf: WorkspaceLeaf, originalEditor: any, plugin: MyTextTools) {
		super(leaf);
		this.plugin = plugin;
		// 初始加载逻辑将由 updateInput 接管，这里仅做基本初始化
		if (originalEditor) {
			this.updateInput(originalEditor);
		}
	}

	/**
	 * 更新输入内容（支持选区模式）
	 */
	updateInput(editor: Editor) {
		this.originalEditor = editor;

		if (editor.somethingSelected()) {
			this.content = editor.getSelection();
			this.selectionRange = {
				start: editor.getCursor("from"),
				end: editor.getCursor("to"),
			};
			new Notice(t("NOTICE_LOAD_SELECTION"));
		} else {
			this.content = editor.getValue();
			this.selectionRange = null;
		}

		// 重置历史记录，因为这是新的上下文
		this.historyManager = new HistoryManager();
		this.render();
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
			!!this.selectionRange, // 传递是否为选区模式
			editorCallbacks,
			this.app
		);

		// --- 3. 右侧：动态设置区域 ---
		const rightPanel = container.createDiv({ cls: "mtt-right-panel" });
		const settingsCallbacks: SettingsPanelCallbacks = {
			onSettingsChange: (key: string, value: any) => {
				(this.settingsState as any)[key] = value;
			},
			onRun: async (toolId: ToolType) => {
				await this.processText(toolId);
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
	async processText(type: ToolType) {
		// 检查是否是 AI 工具
		if (
			type === "ai-extract-keypoints" ||
			type === "ai-summarize" ||
			type === "ai-translate" ||
			type === "ai-polish"
		) {
			await this.processAITool(type);
			return;
		}

		// 普通工具处理
		this.historyManager.pushToHistory(this.content);

		const processedContent = processText(
			type,
			this.content,
			this.settingsState
		);
		this.content = processedContent;

		this.render();
	}

	// 处理 AI 工具
	async processAITool(type: ToolType) {
		// 检查 AI 配置
		const aiService = new AIService(this.plugin.settings);
		if (!aiService.isConfigured()) {
			new Notice("❌ AI 配置不完整，请在设置中配置 API Key");
			return;
		}

		// 保存历史
		this.historyManager.pushToHistory(this.content);

		// 提取要处理的文本（排除 frontmatter 和 header）
		let textToProcess = this.content;
		const fmMatch = textToProcess.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
		if (fmMatch && this.settingsState.preserveFrontmatter) {
			textToProcess = textToProcess.substring(fmMatch[0].length);
		}
		const lines = textToProcess.split("\n");
		if (this.settingsState.preserveHeader && lines.length > 0) {
			textToProcess = lines.slice(1).join("\n");
		}

		if (!textToProcess.trim()) {
			new Notice("❌ 没有可处理的文本内容");
			return;
		}

		// 显示处理中提示
		new Notice("🤖 AI 处理中，请稍候...");

		let result: { content: string; error?: string };

		try {
			// 根据工具类型调用不同的 AI 方法
			switch (type) {
				case "ai-extract-keypoints":
					result = await aiService.extractKeyPoints(textToProcess);
					break;
				case "ai-summarize":
					result = await aiService.summarize(textToProcess);
					break;
				case "ai-translate":
					// 翻译功能可以后续扩展，暂时使用默认英文
					result = await aiService.translate(textToProcess, "英文");
					break;
				case "ai-polish":
					result = await aiService.polish(textToProcess);
					break;
				default:
					result = { content: "", error: "未知的 AI 工具类型" };
			}

			if (result.error) {
				new Notice(`❌ ${result.error}`);
				return;
			}

			// 合并结果：保留 frontmatter 和 header，替换正文
			let finalContent = result.content;
			if (fmMatch && this.settingsState.preserveFrontmatter) {
				finalContent = fmMatch[0] + finalContent;
			}
			if (
				this.settingsState.preserveHeader &&
				lines.length > 0 &&
				lines[0]?.trim()
			) {
				finalContent = lines[0] + "\n" + finalContent;
			}

			this.content = finalContent;
			new Notice("✅ AI 处理完成");
			this.render();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "未知错误";
			new Notice(`❌ AI 处理失败: ${errorMessage}`);
		}
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
