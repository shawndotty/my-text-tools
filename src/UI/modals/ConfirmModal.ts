import { App, Modal, ButtonComponent } from "obsidian";
import { t } from "../../lang/helpers";

export class ConfirmModal extends Modal {
	title: string;
	message: string;
	onConfirm: () => void;
	confirmLabel: string;
	cancelLabel: string;
	isDestructive: boolean;

	constructor(
		app: App,
		title: string,
		message: string,
		onConfirm: () => void,
		confirmLabel: string = t("BTN_CONFIRM"),
		cancelLabel: string = t("BTN_CANCEL"),
		isDestructive: boolean = false
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
		this.confirmLabel = confirmLabel;
		this.cancelLabel = cancelLabel;
		this.isDestructive = isDestructive;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(this.title);
		contentEl.createEl("p", { text: this.message });

		const btnContainer = contentEl.createDiv();
		btnContainer.style.display = "flex";
		btnContainer.style.justifyContent = "flex-end";
		btnContainer.style.gap = "10px";
		btnContainer.style.marginTop = "20px";

		new ButtonComponent(btnContainer)
			.setButtonText(this.cancelLabel)
			.onClick(() => {
				this.close();
			});

		const confirmBtn = new ButtonComponent(btnContainer)
			.setButtonText(this.confirmLabel)
			.onClick(() => {
				this.onConfirm();
				this.close();
			});

		if (this.isDestructive) {
			confirmBtn.setClass("mod-warning");
		} else {
			confirmBtn.setCta();
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
