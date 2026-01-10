import { App, Modal, Setting, ButtonComponent } from "obsidian";
import { t } from "../../lang/helpers";
import { BatchProcess } from "../../types";
import { ConfirmModal } from "./ConfirmModal";

export class ApplyBatchModal extends Modal {
	batches: BatchProcess[];
	onApply: (batch: BatchProcess) => void;
	onDelete: (batch: BatchProcess) => void;
	onEdit: (batch: BatchProcess) => void;
	isShortcutEnabled: (batch: BatchProcess) => boolean;
	onToggleShortcut: (
		batch: BatchProcess,
		enable: boolean
	) => void | Promise<void>;

	constructor(
		app: App,
		batches: BatchProcess[],
		onApply: (batch: BatchProcess) => void,
		onDelete: (batch: BatchProcess) => void,
		onEdit: (batch: BatchProcess) => void,
		isShortcutEnabled: (batch: BatchProcess) => boolean,
		onToggleShortcut: (
			batch: BatchProcess,
			enable: boolean
		) => void | Promise<void>
	) {
		super(app);
		this.batches = batches;
		this.onApply = onApply;
		this.onDelete = onDelete;
		this.onEdit = onEdit;
		this.isShortcutEnabled = isShortcutEnabled;
		this.onToggleShortcut = onToggleShortcut;
	}

	onOpen() {
		const { contentEl } = this;
		this.titleEl.setText(t("MODAL_APPLY_BATCH_TITLE"));

		if (this.batches.length === 0) {
			contentEl.createEl("p", { text: t("NOTICE_NO_BATCHES") });
			return;
		}

		const listContainer = contentEl.createDiv({ cls: "mtt-batch-list" });
		listContainer.style.display = "flex";
		listContainer.style.flexDirection = "column";
		listContainer.style.gap = "10px";

		this.batches.forEach((batch) => {
			const row = listContainer.createDiv({ cls: "mtt-batch-item" });
			row.style.display = "flex";
			row.style.justifyContent = "space-between";
			row.style.alignItems = "center";
			row.style.padding = "8px";
			row.style.border = "1px solid var(--background-modifier-border)";
			row.style.borderRadius = "4px";

			const infoDiv = row.createDiv();
			infoDiv.createEl("span", {
				text: batch.name,
				cls: "mtt-batch-name",
			});
			infoDiv.createEl("div", {
				text: `${batch.operations.length} steps`,
				cls: "mtt-text-muted",
				attr: { style: "font-size: 0.8em;" },
			});

			const btnGroup = row.createDiv({ cls: "mtt-batch-actions" });
			btnGroup.style.display = "flex";
			btnGroup.style.gap = "10px";

			const shortcutBtn = new ButtonComponent(btnGroup).setIcon("zap");
			shortcutBtn.setClass("mod-cta-size");
			const updateShortcutBtnUI = () => {
				const enabled = this.isShortcutEnabled(batch);
				shortcutBtn.buttonEl.toggleClass("mod-cta", enabled);
				shortcutBtn.setTooltip(
					enabled
						? t("TOOLTIP_BATCH_SHORTCUT_DISABLE")
						: t("TOOLTIP_BATCH_SHORTCUT_ENABLE")
				);
			};
			updateShortcutBtnUI();
			shortcutBtn.onClick(async () => {
				const enabled = this.isShortcutEnabled(batch);
				shortcutBtn.setDisabled(true);
				try {
					await this.onToggleShortcut(batch, !enabled);
				} finally {
					shortcutBtn.setDisabled(false);
					updateShortcutBtnUI();
				}
			});

			new ButtonComponent(btnGroup)
				.setButtonText(t("BTN_APPLY"))
				.setCta()
				.onClick(() => {
					this.close();
					this.onApply(batch);
				});

			new ButtonComponent(btnGroup)
				.setIcon("pencil")
				.setTooltip(t("BTN_EDIT"))
				.setClass("mtt-icon-btn")
				.onClick(() => {
					this.close();
					this.onEdit(batch);
				});

			new ButtonComponent(btnGroup)
				.setIcon("trash-2")
				.setTooltip(t("BTN_DELETE"))
				.setClass("mtt-icon-btn")
				.onClick(() => {
					new ConfirmModal(
						this.app,
						t("BTN_DELETE"),
						t("CONFIRM_DELETE_BATCH"),
						() => {
							this.onDelete(batch);
							// Remove from local array to check length
							const index = this.batches.indexOf(batch);
							if (index > -1) {
								this.batches.splice(index, 1);
							}

							// Refresh list
							row.remove();
							if (this.batches.length === 0) {
								this.close();
							}
						},
						t("BTN_DELETE"),
						t("BTN_CANCEL"),
						true
					).open();
				});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
