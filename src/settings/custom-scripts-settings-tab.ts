import { App, ButtonComponent, Notice, Setting, setIcon } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";
import { BatchProcess, migrateToNestedSettings } from "../types";
import type { CustomScript, ScriptParamType } from "./types";
import { IconPickerModal } from "../UI/modals/IconPickerModal";
import { AIService } from "../utils/aiService";
import { AIGenerateScriptModal } from "../UI/modals/AIGenerateScriptModal";
import { ExportScriptModal } from "../UI/modals/ExportScriptModal";

interface CustomScriptsSettingsContext {
	app: App;
	plugin: MyTextTools;
	containerEl: HTMLElement;
	expandedScripts: Set<string>;
	refresh: () => void;
}

export function renderCustomScriptsSettingsTab(
	ctx: CustomScriptsSettingsContext,
) {
	const { app, plugin, containerEl, expandedScripts, refresh } = ctx;

	const settingHeader = containerEl.createDiv({
		cls: "mtt-setting-tab-header",
	});

	settingHeader.createEl("h3", {
		text: t("CUSTOM_SCRIPTS_TITLE"),
	});

	// --- Export / Import Controls ---
	const controlsDiv = settingHeader.createDiv({ cls: "mtt-script-controls" });
	controlsDiv.style.display = "flex";
	controlsDiv.style.gap = "10px";
	controlsDiv.style.marginBottom = "15px";

	new ButtonComponent(controlsDiv)
		.setButtonText(t("BTN_EXPORT_TEXT"))
		.setClass("mtt-icon-btn")
		.setTooltip(t("BTN_EXPORT_SCRIPTS"), {
			placement: "bottom",
			delay: 300,
		})
		.onClick(() => {
			if (plugin.settings.customScripts.length === 0) {
				new Notice(t("NOTICE_NO_SCRIPTS"));
				return;
			}
			new ExportScriptModal(app, plugin.settings.customScripts).open();
		});

	new ButtonComponent(controlsDiv)
		.setButtonText(t("BTN_IMPORT_TEXT"))
		.setClass("mtt-icon-btn")
		.setTooltip(t("BTN_IMPORT_SCRIPTS"), {
			placement: "bottom",
			delay: 300,
		})
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
						throw new Error(
							"Invalid format: Root must be an array",
						);
					}

					// Basic validation
					const validScripts = imported.filter(
						(s: any) =>
							s &&
							typeof s.name === "string" &&
							typeof s.code === "string",
					);

					if (validScripts.length === 0) {
						throw new Error("No valid scripts found in file");
					}

					// Generate new IDs
					const newScripts: CustomScript[] = validScripts.map(
						(s: any) => ({
							...s,
							id:
								Date.now().toString() +
								Math.random().toString(36).substr(2, 9),
							name: s.name,
						}),
					);

					plugin.settings.customScripts.push(...newScripts);
					await plugin.saveSettings();
					(plugin as any).refreshCustomRibbons?.();

					new Notice(t("NOTICE_SCRIPT_IMPORT_SUCCESS"));
					refresh(); // Refresh UI
				} catch (err: any) {
					new Notice(t("NOTICE_SCRIPT_IMPORT_ERROR", [err.message]));
				}
			};
			document.body.appendChild(input);
			input.click();
			document.body.removeChild(input);
		});

	new Setting(containerEl)
		.setName(t("CUSTOM_SCRIPTS_MANAGE"))
		.setDesc(t("CUSTOM_SCRIPTS_DESC"))
		.addButton((btn) =>
			btn.setButtonText(t("BTN_ADD_SCRIPT")).onClick(async () => {
				const nextIndex =
					(plugin.settings.customScripts?.length || 0) + 1;
				const newScript: CustomScript = {
					id: `${Date.now()}`,
					name: `${t("SCRIPT_GROUP_NAME")} ${nextIndex}`,
					description: "",
					icon: "scroll",
					showInRibbon: true,
					code: "return selection.toUpperCase();",
					params: [],
				};
				plugin.settings.customScripts.push(newScript);
				await plugin.saveSettings();
				(plugin as any).refreshCustomRibbons?.();
				refresh();
			}),
		);

	plugin.settings.customScripts.forEach((script, idx) => {
		const cardContainer = containerEl.createDiv({
			cls: "mtt-custom-card",
		});

		const headerSetting = new Setting(cardContainer)
			.setName(
				`${t("SCRIPT_GROUP_NAME")} ${idx + 1}${
					script.name ? ` - ${script.name}` : ""
				}`,
			)
			.addToggle((toggle) =>
				toggle
					.setTooltip(t("TOGGLE_SHOW_IN_LEFT"), {
						placement: "bottom",
						delay: 300,
					})
					.setValue(script.showInRibbon)
					.onChange(async (value) => {
						script.showInRibbon = value;
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("chevron-up")
					.setTooltip(t("BTN_MOVE_UP"), {
						placement: "bottom",
						delay: 300,
					})
					.onClick(async () => {
						if (idx <= 0) return;
						const arr = plugin.settings.customScripts;
						const [item] = arr.splice(idx, 1);
						if (!item) return;
						arr.splice(idx - 1, 0, item);
						await plugin.saveSettings();
						refresh();
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("chevron-down")
					.setTooltip(t("BTN_MOVE_DOWN"), {
						placement: "bottom",
						delay: 300,
					})
					.onClick(async () => {
						const arr = plugin.settings.customScripts;
						if (idx >= arr.length - 1) return;
						const [item] = arr.splice(idx, 1);
						if (!item) return;
						arr.splice(idx + 1, 0, item);
						await plugin.saveSettings();
						refresh();
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("zap")
					.setTooltip(t("TOOLTIP_BATCH_SHORTCUT_ENABLE"), {
						placement: "bottom",
						delay: 300,
					})
					.onClick(async () => {
						const snapshot = migrateToNestedSettings(
							plugin.settings,
						);
						snapshot.savedBatches = [];

						const newBatch: BatchProcess = {
							id: Date.now().toString(),
							name:
								script.name ||
								`${t("SCRIPT_GROUP_NAME")} ${idx + 1}`,
							operations: [
								{
									toolId: `custom-script:${script.id}`,
									settingsSnapshot: snapshot,
								},
							],
						};
						plugin.settings.savedBatches.push(newBatch);
						await plugin.saveSettings();
						new Notice(t("NOTICE_SCRIPT_BATCH_CREATED"), 2000);
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("copy")
					.setTooltip(t("BTN_SAVE_AS_NEW"), {
						placement: "bottom",
						delay: 300,
					})
					.onClick(async () => {
						const newScript: CustomScript = JSON.parse(
							JSON.stringify(script),
						);
						newScript.id = `${Date.now()}`;
						if (newScript.name) {
							newScript.name = `${newScript.name} (copy)`;
						}
						plugin.settings.customScripts.push(newScript);
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
						refresh();
					}),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("trash")
					.setTooltip(t("TOOLTIP_DELETE_SCRIPT"), {
						placement: "bottom",
						delay: 300,
					})
					.onClick(async () => {
						plugin.settings.customScripts =
							plugin.settings.customScripts.filter(
								(s) => s.id !== script.id,
							);
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
						refresh();
					}),
			);

		const headerInfo = headerSetting.settingEl.querySelector(
			".setting-item-info",
		) as HTMLElement | null;
		const bodyEl = cardContainer.createDiv({ cls: "mtt-card-body" });
		let expanded = expandedScripts.has(script.id);
		const arrowEl = document.createElement("span");
		arrowEl.style.marginRight = "6px";
		if (headerInfo) headerInfo.prepend(arrowEl);
		const updateVisibility = () => {
			bodyEl.style.display = expanded ? "block" : "none";
			setIcon(arrowEl, expanded ? "chevron-down" : "chevron-right");
			if (expanded) {
				expandedScripts.add(script.id);
			} else {
				expandedScripts.delete(script.id);
			}
		};
		updateVisibility();
		headerInfo?.addEventListener("click", () => {
			expanded = !expanded;
			updateVisibility();
		});

		bodyEl.createEl("label", {
			text: t("SCRIPT_NAME_PLACEHOLDER"),
		});
		const nameInput = bodyEl.createEl("input", {
			type: "text",
			placeholder: t("SCRIPT_NAME_PLACEHOLDER"),
			value: script.name,
		});
		nameInput.style.width = "100%";
		nameInput.onchange = async (e) => {
			script.name = (e.target as HTMLInputElement).value;
			await plugin.saveSettings();
			(plugin as any).refreshCustomRibbons?.();
		};

		bodyEl.createEl("label", {
			text: t("ICON_PLACEHOLDER"),
		});
		const iconContainer = bodyEl.createDiv();
		iconContainer.style.display = "flex";
		iconContainer.style.gap = "8px";
		iconContainer.style.alignItems = "center";
		iconContainer.style.marginBottom = "10px";

		const iconBtn = new ButtonComponent(iconContainer)
			.setIcon(script.icon || "scroll")
			.setTooltip(t("MODAL_ICON_PICKER_TITLE"), {
				placement: "bottom",
				delay: 300,
			})
			.setClass("mtt-icon-btn")
			.onClick(() => {
				new IconPickerModal(app, async (newIcon) => {
					script.icon = newIcon;
					iconInput.value = newIcon;
					iconBtn.setIcon(newIcon);
					await plugin.saveSettings();
					(plugin as any).refreshCustomRibbons?.();
				}).open();
			});

		const iconInput = iconContainer.createEl("input", {
			type: "text",
			placeholder: t("ICON_PLACEHOLDER"),
			value: script.icon || "scroll",
		});
		iconInput.style.flex = "1";

		iconInput.onchange = async (e) => {
			const val = (e.target as HTMLInputElement).value || "scroll";
			script.icon = val;
			iconBtn.setIcon(val);
			await plugin.saveSettings();
			(plugin as any).refreshCustomRibbons?.();
		};

		bodyEl.createEl("label", {
			text: t("SCRIPT_DESC_LABEL"),
		});
		const descInput = bodyEl.createEl("input", {
			type: "text",
			placeholder: t("SCRIPT_DESC_PLACEHOLDER"),
			value: script.description || "",
		});
		descInput.style.width = "100%";
		descInput.onchange = async (e) => {
			script.description = (e.target as HTMLInputElement).value;
			await plugin.saveSettings();
		};

		bodyEl.createEl("label", {
			text: t("SCRIPT_CODE_LABEL"),
		});
		bodyEl.createEl("p", {
			text: t("SCRIPT_CODE_DESC"),
			cls: "setting-item-description",
		});
		const codeArea = bodyEl.createEl("textarea", {
			cls: "mtt-monospace",
		});
		codeArea.rows = 10;
		codeArea.style.width = "100%";
		codeArea.style.fontFamily = "monospace";
		codeArea.placeholder = t("SCRIPT_CODE_PLACEHOLDER") as string;
		codeArea.value = script.code || "";
		codeArea.onchange = async (e) => {
			script.code = (e.target as HTMLTextAreaElement).value;
			await plugin.saveSettings();
		};

		new Setting(bodyEl).addButton((btn) =>
			btn
				.setButtonText(t("BTN_GENERATE_SCRIPT_AI"))
				.setClass("mtt-icon-btn")
				.setCta()
				.setTooltip(t("BTN_GENERATE_SCRIPT_AI"), {
					placement: "left",
					delay: 300,
				})
				.setIcon("sparkles")
				.onClick(() => {
					const aiService = new AIService(plugin.settings);
					new AIGenerateScriptModal(app, aiService, async (code) => {
						script.code = code;
						codeArea.value = code;
						await plugin.saveSettings();
					}).open();
				}),
		);

		const paramsHeader = bodyEl.createEl("h4", {
			text: t("SCRIPTS_PARAMS_TITLE"),
			cls: "mtt-panel-title",
		});
		paramsHeader.style.marginTop = "12px";
		paramsHeader.style.paddingLeft = "0px";

		new Setting(bodyEl)
			.setName(t("SCRIPTS_PARAMS_MANAGE"))
			.setDesc(t("SCRIPTS_PARAMS_DESC"))
			.addButton((btn) =>
				btn.setButtonText(t("BTN_ADD_PARAM")).onClick(async () => {
					if (!script.params) script.params = [];
					const nextIndex = (script.params?.length || 0) + 1;
					script.params.push({
						key: `param${nextIndex}`,
						label: `${t("PARAM_GROUP_NAME")} ${nextIndex}`,
						type: "text",
						default: "",
					});
					await plugin.saveSettings();
					refresh();
				}),
			);

		(script.params || []).forEach((param, pIdx) => {
			const pCard = bodyEl.createDiv({ cls: "mtt-custom-card" });
			new Setting(pCard)
				.setName(`${t("PARAM_GROUP_NAME")} ${pIdx + 1}`)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip(t("BTN_DELETE_PARAM"), {
							placement: "left",
							delay: 300,
						})
						.onClick(async () => {
							script.params = (script.params || []).filter(
								(_, i) => i !== pIdx,
							);
							await plugin.saveSettings();
							refresh();
						}),
				);

			const grid = pCard.createDiv();
			grid.style.display = "grid";
			grid.style.gridTemplateColumns = "1fr";
			grid.style.gap = "8px";

			const keyContainer = grid.createDiv();
			keyContainer.style.display = "flex";
			keyContainer.style.alignItems = "center";
			keyContainer.style.justifyContent = "space-between";
			keyContainer.style.gap = "8px";
			keyContainer.createEl("label", {
				text: t("PARAM_KEY_LABEL"),
			});
			const keyInput = keyContainer.createEl("input", {
				type: "text",
				value: param.key,
			});
			keyInput.onchange = async (e) => {
				param.key = (e.target as HTMLInputElement).value;
				await plugin.saveSettings();
			};

			const labelContainer = grid.createDiv();
			labelContainer.style.display = "flex";
			labelContainer.style.alignItems = "center";
			labelContainer.style.justifyContent = "space-between";
			labelContainer.style.gap = "8px";
			labelContainer.createEl("label", {
				text: t("PARAM_LABEL_LABEL"),
			});
			const labelInput = labelContainer.createEl("input", {
				type: "text",
				value: param.label || "",
			});
			labelInput.onchange = async (e) => {
				param.label = (e.target as HTMLInputElement).value;
				await plugin.saveSettings();
			};

			const typeContainer = grid.createDiv();
			typeContainer.style.display = "flex";
			typeContainer.style.alignItems = "center";
			typeContainer.style.justifyContent = "space-between";
			typeContainer.style.gap = "8px";
			typeContainer.createEl("label", {
				text: t("PARAM_TYPE_LABEL"),
			});
			const typeSelect = typeContainer.createEl("select");
			["text", "number", "boolean", "select", "array"].forEach((opt) => {
				const o = document.createElement("option");
				o.value = opt;
				o.text =
					opt === "text"
						? (t("PARAM_TYPE_TEXT") as string)
						: opt === "number"
							? (t("PARAM_TYPE_NUMBER") as string)
							: opt === "boolean"
								? (t("PARAM_TYPE_BOOLEAN") as string)
								: opt === "select"
									? (t("PARAM_TYPE_SELECT") as string)
									: (t("PARAM_TYPE_ARRAY") as string);
				if (param.type === opt) o.selected = true;
				typeSelect.appendChild(o);
			});
			typeSelect.onchange = async (e) => {
				param.type = (e.target as HTMLSelectElement)
					.value as ScriptParamType;
				if (param.type !== "select") {
					param.options = undefined;
				}
				await plugin.saveSettings();
				refresh();
			};

			const defaultContainer = grid.createDiv();
			defaultContainer.style.display = "flex";
			defaultContainer.style.alignItems = "center";
			defaultContainer.style.justifyContent = "space-between";
			defaultContainer.style.gap = "8px";
			defaultContainer.createEl("label", {
				text: t("PARAM_DEFAULT_LABEL"),
			});
			if (param.type === "boolean") {
				const checkbox = defaultContainer.createEl("input", {
					type: "checkbox",
				});
				checkbox.checked = !!param.default;
				checkbox.onchange = async (e) => {
					param.default = (e.target as HTMLInputElement).checked;
					await plugin.saveSettings();
				};
			} else if (param.type === "array") {
				const textarea = defaultContainer.createEl("textarea", {
					cls: "mtt-textarea-small",
				});
				textarea.rows = 3;
				textarea.value =
					param.default !== undefined ? String(param.default) : "";
				textarea.onchange = async (e) => {
					const val = (e.target as HTMLTextAreaElement).value;
					param.default = val;
					await plugin.saveSettings();
				};
			} else {
				const input = defaultContainer.createEl("input", {
					type: param.type === "number" ? "number" : "text",
					value:
						param.default !== undefined
							? String(param.default)
							: "",
				});
				input.onchange = async (e) => {
					const val = (e.target as HTMLInputElement).value;
					param.default = param.type === "number" ? Number(val) : val;
					await plugin.saveSettings();
				};
			}

			const optionsContainer = grid.createDiv();
			optionsContainer.style.display = "flex";
			optionsContainer.style.alignItems = "center";
			optionsContainer.style.justifyContent = "space-between";
			optionsContainer.style.gap = "8px";
			const optionsLabel = optionsContainer.createEl("label", {
				text: t("PARAM_OPTIONS_LABEL"),
			});
			const optionsInput = optionsContainer.createEl("input", {
				type: "text",
				value: (param.options || []).join(","),
			});
			optionsInput.onchange = async (e) => {
				const raw = (e.target as HTMLInputElement).value;
				const arr = raw
					.split(",")
					.map((s) => s.trim())
					.filter((s) => s.length > 0);
				param.options = arr.length ? arr : undefined;
				await plugin.saveSettings();
			};
			if (param.type !== "select") {
				optionsLabel.style.display = "none";
				optionsInput.style.display = "none";
				optionsInput.disabled = true;
			}
		});
	});
}
