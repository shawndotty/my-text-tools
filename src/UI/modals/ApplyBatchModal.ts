import { App, Modal, Setting, ButtonComponent } from "obsidian";
import { t } from "../../lang/helpers";
import { BatchProcess } from "../../types";

export class ApplyBatchModal extends Modal {
	batches: BatchProcess[];
	onApply: (batch: BatchProcess) => void;
	onDelete: (batch: BatchProcess) => void;
	onEdit: (batch: BatchProcess) => void;

	constructor(
		app: App,
		batches: BatchProcess[],
		onApply: (batch: BatchProcess) => void,
		onDelete: (batch: BatchProcess) => void,
		onEdit: (batch: BatchProcess) => void
	) {
		super(app);
		this.batches = batches;
		this.onApply = onApply;
		this.onDelete = onDelete;
		this.onEdit = onEdit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: t("MODAL_APPLY_BATCH_TITLE") });

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
			btnGroup.style.gap = "8px";

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
				.onClick(() => {
					this.close();
					this.onEdit(batch);
				});

			new ButtonComponent(btnGroup)
				.setIcon("trash-2")
				.setTooltip(t("BTN_DELETE"))
				.onClick(async () => {
					if (confirm(t("CONFIRM_DELETE_BATCH"))) {
						this.onDelete(batch);
						// Refresh list
						row.remove();
						if (this.batches.length === 0) {
							this.close();
						}
					}
				});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
