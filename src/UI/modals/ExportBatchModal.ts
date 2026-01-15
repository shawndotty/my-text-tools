import { App, Modal, Setting, ButtonComponent, Notice } from "obsidian";
import { t } from "../../lang/helpers";
import { BatchProcess } from "../../types";

export class ExportBatchModal extends Modal {
	batches: BatchProcess[];
	selectedIds: Set<string>;

	constructor(app: App, batches: BatchProcess[]) {
		super(app);
		this.batches = batches;
		// Default to all selected
		this.selectedIds = new Set(batches.map((b) => b.id));
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(t("MODAL_EXPORT_BATCH_TITLE"));

		// --- Control Bar (Select All / Deselect All) ---
		const controlsDiv = contentEl.createDiv({ cls: "mtt-modal-controls" });
		controlsDiv.style.display = "flex";
		controlsDiv.style.justifyContent = "flex-end";
		controlsDiv.style.gap = "10px";
		controlsDiv.style.marginBottom = "15px";

		new ButtonComponent(controlsDiv)
			.setButtonText(t("BTN_SELECT_ALL"))
			.onClick(() => {
				this.batches.forEach((b) => this.selectedIds.add(b.id));
				this.renderList(listContainer);
			});

		new ButtonComponent(controlsDiv)
			.setButtonText(t("BTN_DESELECT_ALL"))
			.onClick(() => {
				this.selectedIds.clear();
				this.renderList(listContainer);
			});

		// --- List Container ---
		const listContainer = contentEl.createDiv({
			cls: "mtt-export-list-container",
		});
		listContainer.style.maxHeight = "400px";
		listContainer.style.overflowY = "auto";
		listContainer.style.border =
			"1px solid var(--background-modifier-border)";
		listContainer.style.borderRadius = "4px";
		listContainer.style.padding = "10px";
		listContainer.style.marginBottom = "20px";

		this.renderList(listContainer);

		// --- Footer Actions ---
		const footer = contentEl.createDiv({ cls: "mtt-modal-footer" });
		footer.style.display = "flex";
		footer.style.justifyContent = "flex-end";
		footer.style.gap = "10px";

		new ButtonComponent(footer)
			.setButtonText(t("BTN_CANCEL"))
			.onClick(() => this.close());

		new ButtonComponent(footer)
			.setButtonText(t("BTN_EXPORT_SELECTED"))
			.setCta()
			.onClick(() => {
				this.handleExport();
			});
	}

	renderList(container: HTMLElement) {
		container.empty();

		if (this.batches.length === 0) {
			container.createEl("p", { text: t("NOTICE_NO_BATCHES") });
			return;
		}

		this.batches.forEach((batch) => {
			const row = container.createDiv({ cls: "mtt-export-item" });
			row.style.display = "flex";
			row.style.alignItems = "center";
			row.style.padding = "8px 0";
			row.style.borderBottom =
				"1px solid var(--background-modifier-border)";

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedIds.has(batch.id);
			checkbox.style.marginRight = "10px";
			checkbox.onchange = (e) => {
				const checked = (e.target as HTMLInputElement).checked;
				if (checked) {
					this.selectedIds.add(batch.id);
				} else {
					this.selectedIds.delete(batch.id);
				}
			};

			const label = row.createEl("span", { text: batch.name });
			label.style.flex = "1";
			label.onclick = () => {
				checkbox.click();
			};

			// Show step count
			row.createEl("span", {
				text: `(${batch.operations.length} steps)`,
				cls: "mtt-text-muted",
				attr: { style: "font-size: 0.85em; margin-left: 10px;" },
			});
		});
	}

	handleExport() {
		if (this.selectedIds.size === 0) {
			new Notice(t("NOTICE_EXPORT_NO_SELECTION"));
			return;
		}

		const exportData = this.batches.filter((b) =>
			this.selectedIds.has(b.id)
		);

		const data = JSON.stringify(exportData, null, 2);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "mytexttools-shortcuts.json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		new Notice(t("NOTICE_BATCH_EXPORT_SUCCESS"));
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}
