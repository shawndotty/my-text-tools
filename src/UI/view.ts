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
import { AIToolConfig } from "../settings";
import { renderToolsPanel } from "./components/ToolsPanel";
import {
	renderEditorPanel,
	EditorPanelCallbacks,
	EditorPanelHandle,
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
	activeTool: string | "" = ""; // 当前选中的工具 ID
	settingsState: SettingsState = { ...DEFAULT_SETTINGS_STATE };
	plugin: MyTextTools; // 插件实例引用
	private loadingEl: HTMLElement | null = null;
	private editorPanelHandle: EditorPanelHandle | null = null;

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

	showLoading(text: string = t("NOTICE_AI_PROCESSING")) {
		if (this.loadingEl) return;
		const overlay = this.contentEl.createDiv({
			cls: "mtt-loading-overlay",
		});
		const box = overlay.createDiv({ cls: "mtt-loading-box" });
		box.createDiv({ cls: "mtt-spinner" });
		box.createDiv({ cls: "mtt-loading-text", text });
		this.loadingEl = overlay;
	}

	hideLoading() {
		if (this.loadingEl) {
			this.loadingEl.detach();
			this.loadingEl = null;
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

		// 保存左侧面板的滚动位置
		const oldLeftPanel = container.querySelector(".mtt-left-panel");
		const savedScrollTop = oldLeftPanel ? oldLeftPanel.scrollTop : 0;

		container.empty();
		container.addClass("mtt-layout-container");

		// --- 1. 左侧：工具导航栏 ---
		const leftPanel = container.createDiv({ cls: "mtt-left-panel" });
		renderToolsPanel(
			leftPanel,
			this.activeTool,
			(toolId) => {
				this.activeTool = toolId;
				this.render(); // 重新渲染以更新 UI 状态
			},
			this.plugin.settings.customActions,
			this.plugin.settings.customScripts,
			this.plugin.settings.enabledTools,
			this.plugin.settings.customIcons
		);

		// 恢复左侧面板的滚动位置
		if (savedScrollTop > 0) {
			leftPanel.scrollTop = savedScrollTop;
		}

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
			onSaveOriginal: () => this.handleSaveToOriginal(),
			onContentChange: (content: string) => {
				this.content = content;
			},
			onProcessSelection: (text: string) => this.processOnSelect(text),
		};
		this.editorPanelHandle = renderEditorPanel(
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
			onRun: async (toolId: string) => {
				if (toolId.startsWith("custom-ai:")) {
					const id = toolId.split(":")[1]!;
					await this.plugin.runCustomAIAction(id);
					return;
				}
				if (toolId.startsWith("custom-script:")) {
					const id = toolId.split(":")[1]!;
					await this.plugin.runCustomScript(id);
					return;
				}
				await this.processText(toolId);
			},
			onSaveAISettings: async (toolId: string, config: AIToolConfig) => {
				if (!this.plugin.settings.aiTools) {
					this.plugin.settings.aiTools = {};
				}
				this.plugin.settings.aiTools[toolId] = config;
				await this.plugin.saveSettings();
			},
		};
		renderGlobalSettings(rightPanel, this.settingsState, settingsCallbacks);
		renderToolSettings(
			rightPanel,
			this.activeTool,
			this.settingsState,
			settingsCallbacks,
			this.plugin.settings.aiTools
		);
	}

	// On-select 处理逻辑
	processOnSelect(text: string): string | null {
		if (
			!(
				this.activeTool === "on-select" &&
				this.settingsState.onSelectEnabled
			)
		)
			return null;

		// 保存历史状态以便撤销
		this.historyManager.pushToHistory(this.content);
		// 立即更新 Undo/Redo 按钮状态
		if (this.editorPanelHandle) {
			this.editorPanelHandle.updateHistoryButtons(
				this.historyManager.canUndo(),
				this.historyManager.canRedo()
			);
		}

		const s = this.settingsState;
		let result = text;

		try {
			switch (s.onSelectAction) {
				case "wrap":
					result = `${s.onSelectPrefix}${text}${s.onSelectSuffix}`;
					break;
				case "regex":
					const flags = s.onSelectCaseInsensitive ? "gi" : "g";
					if (s.onSelectRegex) {
						try {
							const re = new RegExp(s.onSelectFind, flags);
							result = text.replace(re, s.onSelectReplace);
						} catch (e) {
							new Notice(t("NOTICE_REGEX_ERROR"));
							return null;
						}
					} else {
						// 普通查找替换 (转义正则字符)
						const escapeRegExp = (str: string) =>
							str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
						const re = new RegExp(
							escapeRegExp(s.onSelectFind),
							flags
						);
						result = text.replace(re, s.onSelectReplace);
					}
					break;
				case "replace-all":
					result = s.onSelectReplace;
					break;
				case "delete":
					result = "";
					break;
				case "html-entity":
					result = text.replace(/[<>&"']/g, (c) => {
						switch (c) {
							case "<":
								return "&lt;";
							case ">":
								return "&gt;";
							case "&":
								return "&amp;";
							case '"':
								return "&quot;";
							case "'":
								return "&#39;";
							default:
								return c;
						}
					});
					break;
				case "lowercase":
					result = text.toLowerCase();
					break;
				case "uppercase":
					result = text.toUpperCase();
					break;
				default:
					return null;
			}
			new Notice(t("ON_SELECT_NOTICE_PROCESSED"));
			return result;
		} catch (e) {
			console.error("On-select processing error:", e);
			return null;
		}
	}

	// 统一处理文本逻辑
	async processText(type: string) {
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
			type as ToolType,
			this.content,
			this.settingsState
		);
		this.content = processedContent;

		this.render();
	}

	// 处理 AI 工具
	async processAITool(type: string) {
		this.showLoading(t("AI_HINT"));
		// 检查 AI 配置
		const aiService = new AIService(this.plugin.settings);
		if (!aiService.isConfigured()) {
			new Notice("❌ " + t("AI_CONFIG_INCOMPLETE"));
			this.hideLoading();
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
			new Notice("❌ " + t("NOTICE_NO_TEXT"));
			this.hideLoading();
			return;
		}

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
					result = await aiService.translate(textToProcess);
					break;
				case "ai-polish":
					result = await aiService.polish(textToProcess);
					break;
				default:
					result = {
						content: "",
						error: t("NOTICE_UNKNOWN_AI_TOOL"),
					};
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
			new Notice("✅ " + t("NOTICE_AI_DONE"));
			this.render();
			this.hideLoading();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : t("AI_UNKNOWN_ERROR");
			new Notice("❌ " + t("NOTICE_AI_ERROR", [errorMessage]));
			this.hideLoading();
		}
	}

	// 保存回原笔记
	handleSaveToOriginal() {
		if (!this.originalEditor) {
			new Notice("❌ " + t("NOTICE_NO_EDITOR"));
			return;
		}

		console.log("MyTextTools: Saving...", {
			isSelectionMode: !!this.selectionRange,
			range: this.selectionRange,
			contentLength: this.content.length,
		});

		const range = this.selectionRange;
		if (range) {
			// 选区模式：只替换选中的内容
			this.originalEditor.replaceRange(
				this.content,
				range.start,
				range.end
			);
			new Notice(t("NOTICE_SAVE_SELECTION_SUCCESS"));

			// 重新计算 end 坐标
			const lines = this.content.split("\n");
			const lastLineLength = lines[lines.length - 1]!.length;
			const endLine = range!.start.line + lines.length - 1;
			const endCh =
				(lines.length === 1 ? range!.start.ch : 0) + lastLineLength;

			// 更新选区终点
			this.selectionRange!.end = { line: endLine, ch: endCh };
		} else {
			// 全文模式：覆盖整个文件
			saveToOriginal(this.content, this.originalEditor);
		}
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
			this.render();
		}
	}

	// 重做逻辑
	redo() {
		const nextContent = this.historyManager.redo(this.content);
		if (nextContent !== null) {
			this.content = nextContent;
			this.render();
		}
	}

	async saveToNewFile() {
		await saveToNewFile(this.app, this.content);
	}

	getEditorSelection() {
		return this.editorPanelHandle?.getSelection() || null;
	}

	replaceEditorSelection(text: string) {
		this.editorPanelHandle?.replaceSelection(text);
	}

	updateHistoryUI() {
		this.editorPanelHandle?.updateHistoryButtons(
			this.historyManager.canUndo(),
			this.historyManager.canRedo()
		);
	}
}
