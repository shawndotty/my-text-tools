import { App, Modal, Setting } from "obsidian";
import { t } from "../../lang/helpers";

export class SaveBatchModal extends Modal {
	name: string = "";
	onSubmit: (name: string) => void;

	constructor(app: App, onSubmit: (name: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: t("MODAL_SAVE_BATCH_TITLE") });

		new Setting(contentEl)
			.setName(t("MODAL_SAVE_BATCH_NAME"))
			.addText((text) =>
				text
					.setPlaceholder(t("MODAL_SAVE_BATCH_PLACEHOLDER"))
					.onChange((value) => {
						this.name = value;
					})
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("BTN_SAVE_NEW_BATCH")) // Reusing Save button text or could add BTN_SAVE
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.name);
				})
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
