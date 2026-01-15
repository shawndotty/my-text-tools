import { App, ButtonComponent, Notice } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";
import { BatchProcess } from "../types";
import { EditBatchModal } from "../UI/modals/EditBatchModal";
import { ConfirmModal } from "../UI/modals/ConfirmModal";
import { ExportBatchModal } from "../UI/modals/ExportBatchModal";

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

	// --- Export / Import Controls ---
	const controlsDiv = containerEl.createDiv({ cls: "mtt-batch-controls" });
	controlsDiv.style.display = "flex";
	controlsDiv.style.gap = "10px";
	controlsDiv.style.marginBottom = "15px";

	new ButtonComponent(controlsDiv)
		.setButtonText(t("BTN_EXPORT_BATCHES"))
		.setIcon("download")
		.onClick(() => {
			if (plugin.settings.savedBatches.length === 0) {
				new Notice(t("NOTICE_NO_BATCHES"));
				return;
			}
			new ExportBatchModal(app, plugin.settings.savedBatches).open();
		});

	new ButtonComponent(controlsDiv)
		.setButtonText(t("BTN_IMPORT_BATCHES"))
		.setIcon("upload")
		.onClick(() => {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "application/json";
			input.style.display = "none";
			input.onchange = async (e) => {
				const file = (e.target as HTMLInputElement).files?.[0];
				if (!file) return;

				try {
					const text = await file.text();
					const imported = JSON.parse(text);

					if (!Array.isArray(imported)) {
						throw new Error("Invalid format: Root must be an array");
					}

					// Basic validation
					const validBatches = imported.filter(
						(b: any) =>
							b &&
							typeof b.name === "string" &&
							Array.isArray(b.operations)
					);

					if (validBatches.length === 0) {
						throw new Error("No valid shortcuts found in file");
					}

					// Generate new IDs to prevent conflicts
					const newBatches: BatchProcess[] = validBatches.map(
						(b: any) => ({
							...b,
							id:
								Date.now().toString() +
								Math.random().toString(36).substr(2, 9),
							name: b.name,
						})
					);

					plugin.settings.savedBatches.push(...newBatches);
					await plugin.saveSettings();

					new Notice(t("NOTICE_BATCH_IMPORT_SUCCESS"));
					renderBatchProcessSettingsTab(ctx); // Refresh UI
				} catch (err: any) {
					new Notice(t("NOTICE_BATCH_IMPORT_ERROR", [err.message]));
				}
			};
			document.body.appendChild(input);
			input.click();
			document.body.removeChild(input);
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

	batches.forEach((batch, idx) => {
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
			.setIcon("chevron-up")
			.setTooltip(t("BTN_MOVE_UP"))
			.setClass("mtt-icon-btn")
			.setClass("mtt-bare-btn")
			.onClick(async () => {
				if (idx <= 0) return;
				const arr = plugin.settings.savedBatches;
				const [item] = arr.splice(idx, 1);
				if (!item) return;
				arr.splice(idx - 1, 0, item);
				await plugin.saveSettings();
				renderBatchProcessSettingsTab(ctx);
			});

		new ButtonComponent(btnGroup)
			.setIcon("chevron-down")
			.setTooltip(t("BTN_MOVE_DOWN"))
			.setClass("mtt-icon-btn")
			.setClass("mtt-bare-btn")
			.onClick(async () => {
				const arr = plugin.settings.savedBatches;
				if (idx >= arr.length - 1) return;
				const [item] = arr.splice(idx, 1);
				if (!item) return;
				arr.splice(idx + 1, 0, item);
				await plugin.saveSettings();
				renderBatchProcessSettingsTab(ctx);
			});

		new ButtonComponent(btnGroup)
			.setIcon("pencil")
			.setTooltip(t("BTN_EDIT"))
			.setClass("mtt-icon-btn")
			.setClass("mtt-bare-btn")
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
			.setClass("mtt-bare-btn")
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
			.setClass("mtt-bare-btn")
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
