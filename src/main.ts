import { App, Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	MyTextToolsSettings,
	MyTextToolsSettingTab,
} from "./settings";
import { TextToolsModal } from "./UI/TextToolsModal";

// Remember to rename these classes and interfaces!

export default class MyTextTools extends Plugin {
	settings: MyTextToolsSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: "open-text-tools",
			name: "打开文本工具处理箱",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new TextToolsModal(this.app, editor).open();
			},
		});
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
