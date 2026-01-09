import { App, Modal, Setting, ButtonComponent, Notice } from "obsidian";
import { t } from "../../lang/helpers";
import { BatchProcess, BatchOperation, SettingsState } from "../../types";
import {
	renderToolSettings,
	SettingsPanelCallbacks,
} from "../components/SettingsPanel";
import { SaveBatchModal } from "./SaveBatchModal";

export class EditBatchModal extends Modal {
	originalBatch: BatchProcess;
	workingBatch: BatchProcess;
	onSave: (batch: BatchProcess) => void;
	onSaveAsNew: (batch: BatchProcess) => void;

	constructor(
		app: App,
		batch: BatchProcess,
		onSave: (batch: BatchProcess) => void,
		onSaveAsNew: (batch: BatchProcess) => void
	) {
		super(app);
		this.originalBatch = batch;
		// Deep clone to track changes
		this.workingBatch = JSON.parse(JSON.stringify(batch));
		this.onSave = onSave;
		this.onSaveAsNew = onSaveAsNew;
	}

	onOpen() {
		this.renderContent();
	}

	renderContent() {
		const { contentEl } = this;
		this.titleEl.setText(t("MODAL_EDIT_BATCH_TITLE"));
		contentEl.empty();

		// Batch Name (ReadOnly for now, or editable?)
		// User requirement says: modify parameters, reorder, delete. Doesn't explicitly say rename, but Save As New implies naming.
		// Let's show name.
		new Setting(contentEl)
			.setName(t("MODAL_SAVE_BATCH_NAME"))
			.addText((text) =>
				text.setValue(this.workingBatch.name).setDisabled(true)
			);

		const opsContainer = contentEl.createDiv({
			cls: "mtt-batch-ops-container",
		});
		opsContainer.style.display = "flex";
		opsContainer.style.flexDirection = "column";
		opsContainer.style.gap = "15px";
		opsContainer.style.marginTop = "15px";
		opsContainer.style.maxHeight = "60vh";
		opsContainer.style.overflowY = "auto";
		opsContainer.style.paddingRight = "10px"; // scrollbar space

		this.workingBatch.operations.forEach((op, index) => {
			this.renderOperation(opsContainer, op, index);
		});

		this.renderFooter(contentEl);
	}

	renderOperation(container: HTMLElement, op: BatchOperation, index: number) {
		const wrapper = container.createDiv({ cls: "mtt-batch-op-wrapper" });
		wrapper.style.border = "1px solid var(--background-modifier-border)";
		wrapper.style.borderRadius = "6px";
		wrapper.style.padding = "10px";
		wrapper.style.backgroundColor = "var(--background-primary-alt)";

		// Header: Tool Name + Controls
		const header = wrapper.createDiv({ cls: "mtt-batch-op-header" });
		header.style.display = "flex";
		header.style.justifyContent = "space-between";
		header.style.alignItems = "center";
		header.style.marginBottom = "10px";
		header.style.borderBottom =
			"1px solid var(--background-modifier-border)";
		header.style.paddingBottom = "5px";

		// Tool Name (using ID for now, ideally map to readable name but ID is okay)
		// Or use t(`TOOL_${op.toolId.toUpperCase().replace(/-/g, '_')}`) if predictable
		header.createEl("span", {
			text: `${index + 1}. ${op.toolId}`,
			cls: "mtt-batch-op-title",
			attr: { style: "font-weight: bold;" },
		});

		const controls = header.createDiv({ cls: "mtt-batch-op-controls" });

		// Move Up
		new ButtonComponent(controls)
			.setIcon("arrow-up")
			.setTooltip(t("BTN_MOVE_UP"))
			.setDisabled(index === 0)
			.onClick(() => {
				this.moveOp(index, -1);
			});

		// Move Down
		new ButtonComponent(controls)
			.setIcon("arrow-down")
			.setTooltip(t("BTN_MOVE_DOWN"))
			.setDisabled(index === this.workingBatch.operations.length - 1)
			.onClick(() => {
				this.moveOp(index, 1);
			});

		// Delete
		new ButtonComponent(controls)
			.setIcon("trash-2")
			.setTooltip(t("BTN_REMOVE_OP"))
			.onClick(() => {
				if (confirm(t("CONFIRM_DELETE_BATCH"))) {
					// Reusing confirm msg or use new one?
					// Use specific msg if available, or just confirm
					this.deleteOp(index);
				}
			});

		// Settings Body
		const settingsBody = wrapper.createDiv({
			cls: "mtt-batch-op-settings",
		});

		// Create callbacks for this specific operation
		const callbacks: SettingsPanelCallbacks = {
			onSettingsChange: (key, value) => {
				// Update the snapshot
				(op.settingsSnapshot as any)[key] = value;
				// Re-render footer to update buttons state
				// But we don't want to re-render the whole list as it would lose focus
				// So just update footer
				this.updateFooter();
			},
			onRun: () => {}, // Should not be called
			onSaveAISettings: () => {},
			onSaveCustomAIAction: () => {},
		};

		// Render settings
		renderToolSettings(
			settingsBody,
			op.toolId,
			op.settingsSnapshot,
			callbacks,
			undefined, // aiToolsConfig - assuming standard tools for now or load if needed
			undefined, // customScripts
			undefined, // customActions
			{ hideRunButton: true }
		);
	}

	renderFooter(container: HTMLElement) {
		// Clear existing footer if any (simple way: append to main content, if re-rendering whole content works)
		// Since renderContent clears contentEl, this is fine.
		// If I update footer separately, I need a reference.

		const footer = container.createDiv({ cls: "mtt-modal-footer" });
		footer.style.marginTop = "20px";
		footer.style.display = "flex";
		footer.style.justifyContent = "flex-end";
		footer.style.gap = "10px";
		footer.style.borderTop = "1px solid var(--background-modifier-border)";
		footer.style.paddingTop = "15px";

		// Check for changes
		const changed = this.hasChanges();

		if (!changed) {
			new ButtonComponent(footer)
				.setButtonText(t("BTN_CLOSE")) // Localize?
				.onClick(() => this.close());
		} else {
			// Discard
			new ButtonComponent(footer)
				.setButtonText(t("BTN_DISCARD"))
				.onClick(() => {
					if (confirm(t("CONFIRM_DISCARD"))) {
						this.close();
					}
				});

			// Save as New
			new ButtonComponent(footer)
				.setButtonText(t("BTN_SAVE_AS_NEW"))
				.onClick(() => {
					new SaveBatchModal(this.app, (name) => {
						const newBatch = JSON.parse(
							JSON.stringify(this.workingBatch)
						);
						newBatch.id = Date.now().toString(); // Generate new ID
						newBatch.name = name;
						this.onSaveAsNew(newBatch);
						this.close();
					}).open();
				});

			// Save Changes
			new ButtonComponent(footer)
				.setButtonText(t("BTN_SAVE_CHANGES"))
				.setCta()
				.onClick(() => {
					this.onSave(this.workingBatch);
					this.close();
				});
		}
	}

	updateFooter() {
		// A bit hacky to find footer and replace it, but effective
		const footer = this.contentEl.querySelector(".mtt-modal-footer");
		if (footer) {
			footer.remove();
		}
		this.renderFooter(this.contentEl);
	}

	hasChanges(): boolean {
		return (
			JSON.stringify(this.originalBatch) !==
			JSON.stringify(this.workingBatch)
		);
	}

	moveOp(index: number, direction: number) {
		const ops = this.workingBatch.operations;
		const targetIndex = index + direction;
		if (targetIndex >= 0 && targetIndex < ops.length) {
			const temp = ops[index];
			ops[index] = ops[targetIndex]!;
			ops[targetIndex] = temp!;
			this.renderContent();
		}
	}

	deleteOp(index: number) {
		this.workingBatch.operations.splice(index, 1);
		this.renderContent();
	}

	onClose() {
		this.contentEl.empty();
	}
}
