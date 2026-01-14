import { App, ButtonComponent } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";
import { BatchProcess } from "../types";
import { EditBatchModal } from "../UI/modals/EditBatchModal";
import { ConfirmModal } from "../UI/modals/ConfirmModal";

interface BatchProcessSettingsContext {
	app: App;
	plugin: MyTextTools;
	containerEl: HTMLElement;
}

export function renderBatchProcessSettingsTab(
	ctx: BatchProcessSettingsContext
) {
	const { app, plugin, containerEl } = ctx;

	containerEl.empty();
	containerEl.createEl("p", {
		text: t("BatchProcessSettings"),
		cls: "setting-item-description",
	});

	const batches = plugin.settings.savedBatches;

	if (batches.length === 0) {
		containerEl.createEl("p", { text: t("NOTICE_NO_BATCHES") });
		return;
	}

	const listContainer = containerEl.createDiv({ cls: "mtt-batch-list" });
	listContainer.style.display = "flex";
	listContainer.style.flexDirection = "column";
	listContainer.style.gap = "10px";

	batches.forEach((batch) => {
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
			attr: { style: "font-weight: bold; margin-right: 10px;" },
		});
		infoDiv.createEl("span", {
			text: `${batch.operations.length} steps`,
			cls: "mtt-text-muted",
			attr: { style: "font-size: 0.8em; color: var(--text-muted);" },
		});

		const btnGroup = row.createDiv({ cls: "mtt-batch-actions" });
		btnGroup.style.display = "flex";
		btnGroup.style.gap = "10px";

		const shortcutBtn = new ButtonComponent(btnGroup).setIcon("zap");
		shortcutBtn.setClass("mod-cta-size");
		const updateShortcutBtnUI = () => {
			const enabled = plugin.isBatchShortcutEnabled(batch.id);
			shortcutBtn.buttonEl.toggleClass("mod-cta", enabled);
			shortcutBtn.setTooltip(
				enabled
					? t("TOOLTIP_BATCH_SHORTCUT_DISABLE")
					: t("TOOLTIP_BATCH_SHORTCUT_ENABLE")
			);
		};
		updateShortcutBtnUI();
		shortcutBtn.onClick(async () => {
			const enabled = plugin.isBatchShortcutEnabled(batch.id);
			shortcutBtn.setDisabled(true);
			try {
				if (enabled) {
					await plugin.disableBatchShortcut(batch.id);
				} else {
					await plugin.enableBatchShortcut(batch.id);
				}
				updateShortcutBtnUI();
			} finally {
				shortcutBtn.setDisabled(false);
			}
		});

		new ButtonComponent(btnGroup)
			.setIcon("pencil")
			.setTooltip(t("BTN_EDIT"))
			.setClass("mtt-icon-btn")
			.onClick(() => {
				new EditBatchModal(
					app,
					plugin,
					batch,
					async (updatedBatch: BatchProcess) => {
						const index = plugin.settings.savedBatches.findIndex(
							(b) => b.id === batch.id
						);
						if (index !== -1) {
							plugin.settings.savedBatches[index] = updatedBatch;
							await plugin.saveSettings();
							if (plugin.isBatchShortcutEnabled(batch.id)) {
								await plugin.refreshBatchShortcut(batch.id);
							}
							renderBatchProcessSettingsTab(ctx);
						}
					},
					async (newBatch: BatchProcess) => {
						plugin.settings.savedBatches.push(newBatch);
						await plugin.saveSettings();
						renderBatchProcessSettingsTab(ctx);
					}
				).open();
			});

		new ButtonComponent(btnGroup)
			.setIcon("copy")
			.setTooltip(t("BTN_SAVE_AS_NEW"))
			.setClass("mtt-icon-btn")
			.onClick(async () => {
				const newBatch: BatchProcess = {
					id: Date.now().toString(),
					name: `${batch.name} (copy)`,
					operations: JSON.parse(JSON.stringify(batch.operations)),
				};
				plugin.settings.savedBatches.push(newBatch);
				await plugin.saveSettings();
				renderBatchProcessSettingsTab(ctx);
			});

		new ButtonComponent(btnGroup)
			.setIcon("trash")
			.setTooltip(t("BTN_DELETE"))
			.setClass("mtt-icon-btn")
			.onClick(() => {
				new ConfirmModal(
					app,
					t("CONFIRM_DELETE_BATCH_TITLE"),
					t("CONFIRM_DELETE_BATCH_DESC", [batch.name]),
					async () => {
						plugin.settings.savedBatches =
							plugin.settings.savedBatches.filter(
								(b) => b.id !== batch.id
							);
						await plugin.saveSettings();
						await plugin.disableBatchShortcut(batch.id);
						renderBatchProcessSettingsTab(ctx);
					}
				).open();
			});
	});
}
