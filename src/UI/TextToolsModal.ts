import { App, Editor, Modal, Setting } from "obsidian";
export class TextToolsModal extends Modal {
	editor: Editor;
	findText: string = "";
	replaceText: string = "";

	constructor(app: App, editor: Editor) {
		super(app);
		this.editor = editor;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "MyTextTools 本地版" });

		// --- 功能按钮区域 ---
		const btnContainer = contentEl.createDiv({ cls: "tt-btn-grid" });

		// 样式可以放在 CSS 中，这里演示逻辑
		this.createToolButton(btnContainer, "去除重复行", () => {
			const content =
				this.editor.getSelection() || this.editor.getValue();
			const result = Array.from(new Set(content.split("\n"))).join("\n");
			this.updateText(result);
		});

		this.createToolButton(btnContainer, "去除空行", () => {
			const content =
				this.editor.getSelection() || this.editor.getValue();
			const result = content
				.split("\n")
				.filter((line) => line.trim() !== "")
				.join("\n");
			this.updateText(result);
		});

		contentEl.createEl("hr");

		// --- 正则查找替换区域 ---
		contentEl.createEl("h3", { text: "正则查找替换" });

		new Setting(contentEl)
			.setName("查找 (支持正则)")
			.addText((text) =>
				text.onChange((value) => (this.findText = value))
			);

		new Setting(contentEl)
			.setName("替换为")
			.addText((text) =>
				text.onChange((value) => (this.replaceText = value))
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("立即执行替换")
				.setCta()
				.onClick(() => {
					const content =
						this.editor.getSelection() || this.editor.getValue();
					try {
						const regex = new RegExp(this.findText, "g");
						const result = content.replace(regex, this.replaceText);
						this.updateText(result);
					} catch (e) {
						alert("正则格式有误，请检查");
					}
				})
		);
	}

	// 辅助函数：创建按钮
	createToolButton(
		container: HTMLElement,
		label: string,
		onClick: () => void
	) {
		const btn = container.createEl("button", {
			text: label,
			cls: "tt-button",
		});
		btn.onclick = onClick;
	}

	// 辅助函数：将处理好的文本写回编辑器
	updateText(newText: string) {
		const selection = this.editor.getSelection();
		if (selection) {
			this.editor.replaceSelection(newText);
		} else {
			this.editor.setValue(newText);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
