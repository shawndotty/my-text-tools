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
import { BatchProcess, MyTextToolsPlugin } from "./types";
import { ScriptManager } from "./managers/ScriptManager";
import { AIManager } from "./managers/AIManager";
import { BatchManager } from "./managers/BatchManager";

// Remember to rename these classes and interfaces!

export default class MyTextTools extends Plugin implements MyTextToolsPlugin {
	settings: MyTextToolsSettings;
	scriptManager: ScriptManager;
	aiManager: AIManager;
	batchManager: BatchManager;
	private customRibbonEls: HTMLElement[] = [];

	async onload() {
		await this.loadSettings();

		// Initialize Managers
		this.scriptManager = new ScriptManager(this);
		this.aiManager = new AIManager(this);
		this.batchManager = new BatchManager(
			this,
			this.scriptManager,
			this.aiManager
		);

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
			(evt: MouseEvent) => {
				if (evt.shiftKey) {
					this.activateView(true);
				} else {
					this.activateView();
				}
			}
		);

		// 自定义卡片入口改为工作台左侧工具栏展示，不再添加到 Obsidian 全局侧栏

		await this.batchManager.syncBatchShortcuts();

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

				const enabledBatchIds =
					this.batchManager.getEnabledBatchShortcutIds();
				if (enabledBatchIds.length === 0) return;

				const batches = enabledBatchIds
					.map((id) =>
						this.settings.savedBatches.find((b) => b.id === id)
					)
					.filter((b): b is BatchProcess => !!b);
				if (batches.length === 0) return;

				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle(t("MENU_BATCH_SHORTCUTS_LABEL"))
						.setIcon("zap")
						.setIsLabel(true);
				});

				for (const batch of batches) {
					menu.addItem((item) => {
						item.setTitle(t("MENU_BATCH_RUN_NOTE", [batch.name]))
							.setIcon("zap")
							.onClick(() => {
								void this.runBatchShortcut(batch.id, "note");
							});
					});
					menu.addItem((item) => {
						item.setTitle(
							t("MENU_BATCH_RUN_SELECTION", [batch.name])
						)
							.setIcon("zap")
							.setDisabled(!editor.somethingSelected())
							.onClick(() => {
								void this.runBatchShortcut(
									batch.id,
									"selection"
								);
							});
					});
				}
			})
		);
	}

	async activateView(openInNewWindow = false) {
		const { workspace } = this.app;

		// 在切换视图之前，记录当前激活的 Markdown 笔记
		const prevMarkdownView =
			workspace.getActiveViewOfType(MarkdownView) || null;

		// 优先检查是否已打开
		let leaf = workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];

		if (!leaf) {
			if (openInNewWindow) {
				leaf = workspace.getLeaf("window");
			} else {
				leaf = workspace.getLeaf("tab");
			}
		}

		await leaf.setViewState({
			type: MY_TEXT_TOOLS_VIEW,
			active: true,
		});

		workspace.revealLeaf(leaf);

		// 激活视图时，更新内容：
		// - 如果是新窗口，优先使用当时的激活笔记
		// - 如果在 Tab 中打开，也使用打开命令触发时的笔记内容
		const sourceView = prevMarkdownView;
		if (sourceView && sourceView.editor) {
			const view = leaf.view as MyTextToolsView;
			if (view) {
				view.updateInput(sourceView.editor, sourceView.file);
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

	// Delegated Methods

	isBatchShortcutEnabled(batchId: string): boolean {
		return this.batchManager.isBatchShortcutEnabled(batchId);
	}

	async enableBatchShortcut(batchId: string) {
		return this.batchManager.enableBatchShortcut(batchId);
	}

	async disableBatchShortcut(batchId: string) {
		return this.batchManager.disableBatchShortcut(batchId);
	}

	async refreshBatchShortcut(batchId: string) {
		return this.batchManager.refreshBatchShortcut(batchId);
	}

	async runBatchShortcut(
		batchId: string,
		scope: "note" | "selection",
		editor?: Editor
	) {
		return this.batchManager.runBatchShortcut(batchId, scope, editor);
	}

	async runCustomScript(scriptId: string) {
		return this.scriptManager.runCustomScript(scriptId);
	}

	async runCustomAIAction(actionId: string) {
		return this.aiManager.runCustomAIAction(actionId);
	}
}
