import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	WorkspaceLeaf,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	MyTextToolsSettings,
	MyTextToolsSettingTab,
} from "./settings";
import { MyTextToolsView, MY_TEXT_TOOLS_VIEW } from "./UI/view";
import { t } from "./lang/helpers";
import { AIService } from "./utils/aiService";
import { ScriptExecutor } from "./utils/scriptExecutor";

// Remember to rename these classes and interfaces!

export default class MyTextTools extends Plugin {
	settings: MyTextToolsSettings;
	private customRibbonEls: HTMLElement[] = [];

	async onload() {
		await this.loadSettings();

		// 0. 注册设置标签页
		this.addSettingTab(new MyTextToolsSettingTab(this.app, this));

		// 1. 注册视图类型
		this.registerView(MY_TEXT_TOOLS_VIEW, (leaf) => {
			// 获取当前活动的编辑器作为"原笔记"引用
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = activeView ? activeView.editor : null;
			const file = activeView ? activeView.file : null;
			return new MyTextToolsView(leaf, editor, file, this);
		});

		// 2. 添加触发命令
		this.addCommand({
			id: "open-mytexttools-workspace",
			name: t("COMMAND_OPEN_WORKBENCH"),
			callback: () => {
				this.activateView();
			},
		});

		// 3. 添加 ribbon icon 触发命令
		this.addRibbonIcon(
			"remove-formatting",
			t("COMMAND_OPEN_WORKBENCH"),
			() => {
				this.activateView();
			}
		);

		// 自定义卡片入口改为工作台左侧工具栏展示，不再添加到 Obsidian 全局侧栏

		// 4. 添加右键菜单
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				menu.addItem((item) => {
					item.setTitle(t("MENU_OPEN_PLUGIN"))
						.setIcon("remove-formatting")
						.onClick(async () => {
							await this.activateView();
						});
				});
			})
		);
	}

	async activateView() {
		const { workspace } = this.app;

		// 优先检查是否已打开
		let leaf = workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];

		if (!leaf) {
			// 这里的 'window' 会创建一个真正的弹出窗口
			leaf = workspace.getLeaf("window");
			await leaf.setViewState({
				type: MY_TEXT_TOOLS_VIEW,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);

		// 激活视图时，更新内容
		const activeView = workspace.getActiveViewOfType(MarkdownView);
		if (activeView && activeView.editor) {
			const view = leaf.view as MyTextToolsView;
			if (view) {
				view.updateInput(activeView.editor, activeView.file);
			}
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyTextToolsSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 刷新视图
	refreshCustomRibbons() {
		const leaves = this.app.workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW);
		leaves.forEach((leaf) => {
			if (leaf.view instanceof MyTextToolsView) {
				leaf.view.render();
			}
		});
	}

	// 执行自定义 JS 脚本
	async runCustomScript(scriptId: string) {
		const script = this.settings.customScripts?.find(
			(s) => s.id === scriptId
		);
		if (!script) {
			new Notice(t("NOTICE_SCRIPT_NOT_FOUND"));
			return;
		}

		// 获取当前内容和选区
		let content = "";
		let selection = "";
		let updateCallback: (newText: string) => void = () => {};

		const mttLeaf =
			this.app.workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (
			mttLeaf &&
			mttLeaf.view &&
			mttLeaf.view instanceof MyTextToolsView
		) {
			const view = mttLeaf.view as MyTextToolsView;
			content = view.content;

			const currentSelection = view.getEditorSelection();
			if (currentSelection) {
				selection = currentSelection.text;
			} else {
				selection = "";
			}

			updateCallback = (newText: string) => {
				view.historyManager.pushToHistory(view.content);
				if (currentSelection) {
					view.replaceEditorSelection(newText);
					view.updateHistoryUI();
				} else {
					view.content = newText;
					view.render();
					view.updateHistoryUI();
				}
			};
		} else if (activeView && activeView.editor) {
			const editor = activeView.editor;
			content = editor.getValue();
			selection = editor.getSelection();
			updateCallback = (newText: string) => {
				if (selection) {
					editor.replaceSelection(newText);
				} else {
					editor.setValue(newText);
				}
			};
		} else {
			new Notice(t("NOTICE_NO_EDITOR"));
			return;
		}

		const usesSelectionOnly =
			/\bselection\b/.test(script.code) && !/\btext\b/.test(script.code);
		const hasSelection = !!selection;
		if (!hasSelection && usesSelectionOnly) {
			new Notice(t("NOTICE_NO_SELECTION"));
			return;
		}

		try {
			const executor = new ScriptExecutor(this.app);
			let params: Record<string, any> = {};
			if (script.params && script.params.length > 0) {
				if (
					mttLeaf &&
					mttLeaf.view &&
					mttLeaf.view instanceof MyTextToolsView
				) {
					const view = mttLeaf.view as MyTextToolsView;
					params = script.params.reduce((acc, p) => {
						const key = `custom:${script.id}:${p.key}`;
						const val = (view.settingsState as any)[key];
						let finalVal = val !== undefined ? val : p.default;

						// 如果是文本类型，处理转义字符
						if (p.type === "text" && typeof finalVal === "string") {
							finalVal = finalVal
								.replace(/\\n/g, "\n")
								.replace(/\\t/g, "\t")
								.replace(/\\r/g, "\r");
						}

						// 如果是数组类型，按换行符分割
						if (
							p.type === "array" &&
							typeof finalVal === "string"
						) {
							finalVal = finalVal.split(/\r?\n/);
						}

						acc[p.key] = finalVal;
						return acc;
					}, {} as Record<string, any>);
				}
			}
			const result = await executor.execute(
				script.code,
				content,
				selection,
				params
			);

			if (typeof result === "string") {
				updateCallback(result);
				new Notice(t("NOTICE_SCRIPT_SUCCESS"));
			}
		} catch (error: any) {
			console.error("Script execution failed:", error);
			new Notice(t("NOTICE_SCRIPT_ERROR").replace("{0}", error.message));
		}
	}

	// 执行自定义 AI 动作
	async runCustomAIAction(actionId: string) {
		const action =
			this.settings.customActions?.find((a) => a.id === actionId) || null;
		if (!action) {
			new Notice(t("NOTICE_PROMPT_NOT_FOUND"));
			return;
		}

		const mttLeaf =
			this.app.workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		// 合并设置
		const merged: MyTextToolsSettings = {
			...this.settings,
			aiProvider: action.overrideProvider ?? this.settings.aiProvider,
			aiApiUrl: action.overrideApiUrl ?? this.settings.aiApiUrl,
			aiApiKey: action.overrideApiKey ?? this.settings.aiApiKey,
			aiModel: action.overrideModel ?? this.settings.aiModel,
			aiMaxTokens: action.overrideMaxTokens ?? this.settings.aiMaxTokens,
			aiTemperature:
				action.overrideTemperature ?? this.settings.aiTemperature,
		};

		const aiService = new AIService(merged);
		// 情况一：优先工作台视图，支持保护与历史
		if (
			mttLeaf &&
			mttLeaf.view &&
			mttLeaf.view instanceof MyTextToolsView
		) {
			const view = mttLeaf.view as MyTextToolsView;
			view.showLoading(t("NOTICE_AI_PROCESSING"));
			const src = view.content || "";
			if (!src.trim()) {
				new Notice(t("NOTICE_NO_TEXT"));
				view.hideLoading();
				return;
			}
			view.historyManager.pushToHistory(view.content);

			let textToProcess = src;
			const fmMatch = textToProcess.match(
				/^---\n([\s\S]*?)\n---(?:\n|$)/
			);
			if (fmMatch && (view.settingsState as any).preserveFrontmatter) {
				textToProcess = textToProcess.substring(fmMatch[0].length);
			}
			const lines = textToProcess.split("\n");
			if (
				(view.settingsState as any).preserveHeader &&
				lines.length > 0
			) {
				textToProcess = lines.slice(1).join("\n");
			}

			const result = await aiService.processText(
				action.prompt || "",
				textToProcess,
				action.systemPrompt || ""
			);
			if (result.error) {
				new Notice(`❌ ${result.error}`);
				view.hideLoading();
				return;
			}
			let finalContent = result.content;
			if (fmMatch && (view.settingsState as any).preserveFrontmatter) {
				finalContent = fmMatch[0] + finalContent;
			}
			if (
				(view.settingsState as any).preserveHeader &&
				lines.length > 0 &&
				lines[0]?.trim()
			) {
				finalContent = lines[0] + "\n" + finalContent;
			}
			view.content = finalContent;
			view.render();
			view.hideLoading();
			new Notice("✅ " + t("NOTICE_AI_DONE"));
			return;
		}

		// 情况二：活动的 Markdown 编辑器
		if (activeView && activeView.editor) {
			const editor = activeView.editor;
			const selection = editor.getSelection();
			const useSelection =
				action.applyToSelection && selection && selection.length > 0;
			if (useSelection) {
				if (!selection.trim()) {
					new Notice(t("NOTICE_NO_TEXT"));
					return;
				}
				const result = await aiService.processText(
					action.prompt || "",
					selection,
					action.systemPrompt || ""
				);
				if (result.error) {
					new Notice("❌ " + t("NOTICE_AI_ERROR", [result.error]));
					return;
				}
				editor.replaceSelection(result.content);
				new Notice(t("NOTICE_AI_DONE"));
				return;
			}
			const fullText = editor.getValue();
			if (!fullText.trim()) {
				new Notice(t("NOTICE_NO_TEXT"));
				return;
			}
			let textToProcess = fullText;
			const fmMatch = textToProcess.match(
				/^---\n([\s\S]*?)\n---(?:\n|$)/
			);
			if (fmMatch) {
				textToProcess = textToProcess.substring(fmMatch[0].length);
			}
			const lines = textToProcess.split("\n");
			if (lines.length > 0) {
				textToProcess = lines.slice(1).join("\n");
			}
			const result = await aiService.processText(
				action.prompt || "",
				textToProcess,
				action.systemPrompt || ""
			);
			if (result.error) {
				new Notice("❌ " + t("NOTICE_AI_ERROR", [result.error]));
				return;
			}
			let finalContent = result.content;
			if (fmMatch) {
				finalContent = fmMatch[0] + finalContent;
			}
			if (lines.length > 0 && lines[0]?.trim()) {
				finalContent = lines[0] + "\n" + finalContent;
			}
			editor.setValue(finalContent);
			new Notice(t("NOTICE_AI_DONE"));
			return;
		}

		// 情况三：均不可用
		new Notice(t("NOTICE_NO_EDITOR"));
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText(t("MODAL_SAMPLE_TEXT"));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
