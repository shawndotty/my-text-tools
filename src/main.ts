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

// Remember to rename these classes and interfaces!

export default class MyTextTools extends Plugin {
	settings: MyTextToolsSettings;

	async onload() {
		await this.loadSettings();
		// 1. 注册视图类型
		this.registerView(MY_TEXT_TOOLS_VIEW, (leaf) => {
			// 获取当前活动的编辑器作为“原笔记”引用
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = activeView ? activeView.editor : null;
			return new MyTextToolsView(leaf, editor);
		});

		// 2. 添加触发命令
		this.addCommand({
			id: "open-mytexttools-workspace",
			name: "开启 MyTextTools 增强工作台",
			callback: () => {
				this.activateView();
			},
		});

		// 3. 添加 ribbon icon 触发命令
		this.addRibbonIcon(
			"remove-formatting",
			"开启 MyTextTools 增强工作台",
			() => {
				this.activateView();
			}
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
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
