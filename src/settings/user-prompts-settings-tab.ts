import { App, ButtonComponent, Notice, Setting, setIcon } from "obsidian";
import { t } from "lang/helpers";
import { BatchProcess, migrateToNestedSettings } from "../types";
import MyTextTools from "../main";
import type { CustomAIAction } from "./types";
import { IconPickerModal } from "../UI/modals/IconPickerModal";
import { AIService } from "../utils/aiService";
import { AIGeneratePromptModal } from "../UI/modals/AIGeneratePromptModal";

interface UserPromptsSettingsContext {
	app: App;
	plugin: MyTextTools;
	containerEl: HTMLElement;
	expandedScripts: Set<string>;
	refresh: () => void;
}

export function renderUserPromptsSettingsTab(ctx: UserPromptsSettingsContext) {
	const { app, plugin, containerEl, expandedScripts, refresh } = ctx;

	containerEl.createEl("h3", {
		text: t("CUSTOM_PROMPTS_TITLE"),
	});

	new Setting(containerEl)
		.setName(t("CUSTOM_PROMPTS_MANAGE"))
		.setDesc(t("CUSTOM_PROMPTS_DESC"))
		.addButton((btn) =>
			btn.setButtonText(t("BTN_ADD_PROMPT")).onClick(async () => {
				const nextIndex = (plugin.settings.customActions?.length || 0) + 1;
				const newCard: CustomAIAction = {
					id: `${Date.now()}`,
					name: `${t("PROMPT_GROUP_NAME")} ${nextIndex}`,
					icon: "sparkles",
					showInRibbon: true,
					prompt: "",
					systemPrompt: "",
					applyToSelection: true,
					overrideEnabled: false,
				};
				plugin.settings.customActions.push(newCard);
				await plugin.saveSettings();
				(plugin as any).refreshCustomRibbons?.();
				refresh();
			})
		);

	plugin.settings.customActions.forEach((card, idx) => {
		const cardContainer = containerEl.createDiv({
			cls: "mtt-custom-card",
		});

		const headerSetting = new Setting(cardContainer)
			.setName(
				`${t("PROMPT_GROUP_NAME")} ${idx + 1}${
					card.name ? ` - ${card.name}` : ""
				}`
			)
			.addToggle((toggle) =>
				toggle
					.setTooltip(t("TOGGLE_SHOW_IN_LEFT"))
					.setValue(card.showInRibbon)
					.onChange(async (value) => {
						card.showInRibbon = value;
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("chevron-up")
					.setTooltip(t("BTN_MOVE_UP"))
					.onClick(async () => {
						if (idx <= 0) return;
						const arr = plugin.settings.customActions;
						const [item] = arr.splice(idx, 1);
						if (!item) return;
						arr.splice(idx - 1, 0, item);
						await plugin.saveSettings();
						refresh();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("chevron-down")
					.setTooltip(t("BTN_MOVE_DOWN"))
					.onClick(async () => {
						const arr = plugin.settings.customActions;
						if (idx >= arr.length - 1) return;
						const [item] = arr.splice(idx, 1);
						if (!item) return;
						arr.splice(idx + 1, 0, item);
						await plugin.saveSettings();
						refresh();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("zap")
					.setTooltip(t("TOOLTIP_BATCH_SHORTCUT_ENABLE"))
					.onClick(async () => {
						const snapshot = migrateToNestedSettings(plugin.settings);
						snapshot.savedBatches = [];

						const newBatch: BatchProcess = {
							id: Date.now().toString(),
							name:
								card.name ||
								`${t("PROMPT_GROUP_NAME")} ${idx + 1}`,
							operations: [
								{
									toolId: `custom-ai:${card.id}`,
									settingsSnapshot: snapshot,
								},
							],
						};
						plugin.settings.savedBatches.push(newBatch);
						await plugin.saveSettings();
						new Notice(t("NOTICE_PROMPT_BATCH_CREATED"), 2000);
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("copy")
					.setTooltip(t("BTN_SAVE_AS_NEW"))
					.onClick(async () => {
						const newCard: CustomAIAction = JSON.parse(
							JSON.stringify(card)
						);
						newCard.id = `${Date.now()}`;
						if (newCard.name) {
							newCard.name = `${newCard.name} (copy)`;
						}
						plugin.settings.customActions.push(newCard);
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
						refresh();
					})
			)
			.addExtraButton((btn) =>
				btn
					.setIcon("trash")
					.setTooltip(t("TOOLTIP_DELETE_PROMPT"))
					.onClick(async () => {
						plugin.settings.customActions =
							plugin.settings.customActions.filter(
								(c) => c.id !== card.id
							);
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
						refresh();
					})
			);

		const headerInfo = headerSetting.settingEl.querySelector(
			".setting-item-info"
		) as HTMLElement | null;
		const bodyEl = cardContainer.createDiv({ cls: "mtt-card-body" });
		let expanded = expandedScripts.has(card.id);
		const arrowEl = document.createElement("span");
		arrowEl.style.marginRight = "6px";
		if (headerInfo) headerInfo.prepend(arrowEl);
		const updateVisibility = () => {
			bodyEl.style.display = expanded ? "block" : "none";
			setIcon(arrowEl, expanded ? "chevron-down" : "chevron-right");
			if (expanded) {
				expandedScripts.add(card.id);
			} else {
				expandedScripts.delete(card.id);
			}
		};
		updateVisibility();
		headerInfo?.addEventListener("click", () => {
			expanded = !expanded;
			updateVisibility();
		});

		bodyEl.createEl("label", { text: t("PROMPT_NAME_PLACEHOLDER") });
		const nameInput = bodyEl.createEl("input", {
			type: "text",
			placeholder: t("PROMPT_NAME_PLACEHOLDER"),
			value: card.name,
		});
		nameInput.style.width = "100%";
		nameInput.onchange = async (e) => {
			card.name = (e.target as HTMLInputElement).value;
			await plugin.saveSettings();
			(plugin as any).refreshCustomRibbons?.();
		};

		bodyEl.createEl("label", { text: t("ICON_PLACEHOLDER") });
		const iconContainer = bodyEl.createDiv();
		iconContainer.style.display = "flex";
		iconContainer.style.gap = "8px";
		iconContainer.style.alignItems = "center";
		iconContainer.style.marginBottom = "10px";

		const iconBtn = new ButtonComponent(iconContainer)
			.setIcon(card.icon || "sparkles")
			.setTooltip(t("MODAL_ICON_PICKER_TITLE"))
			.onClick(() => {
				new IconPickerModal(app, async (newIcon) => {
					card.icon = newIcon;
					iconInput.value = newIcon;
					iconBtn.setIcon(newIcon);
					await plugin.saveSettings();
					(plugin as any).refreshCustomRibbons?.();
				}).open();
			});
		iconBtn.setClass("mtt-icon-btn");

		const iconInput = iconContainer.createEl("input", {
			type: "text",
			placeholder: t("ICON_PLACEHOLDER"),
			value: card.icon || "sparkles",
		});
		iconInput.style.flex = "1";

		iconInput.onchange = async (e) => {
			const val = (e.target as HTMLInputElement).value || "sparkles";
			card.icon = val;
			iconBtn.setIcon(val);
			await plugin.saveSettings();
			(plugin as any).refreshCustomRibbons?.();
		};

		const promptContainer = bodyEl.createDiv();
		promptContainer.style.display = "flex";
		promptContainer.style.gap = "8px";
		promptContainer.style.alignItems = "flex-start";
		promptContainer.style.justifyContent = "space-between";

		const promptLeftDiv = promptContainer.createDiv();
		promptLeftDiv.createEl("label", {
			text: t("PROMPT_FIELD_LABEL"),
		});
		promptLeftDiv.createEl("p", {
			text: t("PROMPT_FIELD_DESC"),
			cls: "setting-item-description",
		});

		const promptAiBtn = new ButtonComponent(promptContainer)
			.setIcon("sparkles")
			.setTooltip(t("TOOLTIP_GENERATE_PROMPT_AI"))
			.onClick(() => {
				const aiService = new AIService(plugin.settings);
				new AIGeneratePromptModal(
					app,
					aiService,
					async (result) => {
						card.prompt = result.userPrompt;
						card.systemPrompt = result.systemPrompt;
						promptArea.value = result.userPrompt;
						sysArea.value = result.systemPrompt;
						await plugin.saveSettings();
					}
				).open();
			});

		promptAiBtn.setClass("mtt-ai-btn");
		promptAiBtn.setCta();

		const promptArea = bodyEl.createEl("textarea");
		promptArea.rows = 4;
		promptArea.style.width = "100%";
		promptArea.placeholder = t("PROMPT_PLACEHOLDER") as string;
		promptArea.value = card.prompt || "";
		promptArea.onchange = async (e) => {
			card.prompt = (e.target as HTMLTextAreaElement).value;
			await plugin.saveSettings();
		};

		bodyEl.createEl("label", { text: t("SYSTEM_PROMPT_LABEL") });
		bodyEl.createEl("p", {
			text: t("SYSTEM_PROMPT_DESC"),
			cls: "setting-item-description",
		});
		const sysArea = bodyEl.createEl("textarea");
		sysArea.rows = 3;
		sysArea.style.width = "100%";
		sysArea.placeholder = t("SYSTEM_PROMPT_PLACEHOLDER") as string;
		sysArea.value = card.systemPrompt || "";
		sysArea.onchange = async (e) => {
			card.systemPrompt = (e.target as HTMLTextAreaElement).value;
			await plugin.saveSettings();
		};

		new Setting(bodyEl)
			.setName(t("APPLY_SCOPE_LABEL"))
			.setDesc(t("APPLY_SCOPE_DESC"))
			.addToggle((toggle) =>
				toggle
					.setValue(card.applyToSelection)
					.onChange(async (value) => {
						card.applyToSelection = value;
						await plugin.saveSettings();
					})
			);

		let useOverride =
			!!card.overrideEnabled ||
			!!card.overrideProvider ||
			!!card.overrideApiUrl ||
			!!card.overrideApiKey ||
			!!card.overrideModel ||
			card.overrideMaxTokens !== undefined ||
			card.overrideTemperature !== undefined;

		const pluginRef = plugin;
		function renderOverride() {
			if (!overrideSection) return;
			overrideSection.empty();
			if (!useOverride) return;

			new Setting(overrideSection)
				.setName(t("PROVIDER_LABEL"))
				.addDropdown((dropdown) =>
					dropdown
						.addOption("deepseek", "Deepseek")
						.addOption("openai", "OpenAI")
						.addOption("custom", t("PROVIDER_OPTION_CUSTOM"))
						.setValue(
							card.overrideProvider ||
								pluginRef.settings.aiProvider
						)
						.onChange(async (value) => {
							card.overrideProvider = value as any;
							if (value === "deepseek") {
								card.overrideApiUrl =
									"https://api.deepseek.com/v1/chat/completions";
								card.overrideModel = "deepseek-chat";
							} else if (value === "openai") {
								card.overrideApiUrl =
									"https://api.openai.com/v1/chat/completions";
								card.overrideModel = "gpt-3.5-turbo";
							}
							await pluginRef.saveSettings();
						})
				);

			new Setting(overrideSection)
				.setName(t("API_KEY_LABEL"))
				.addText((text) => {
					text.inputEl.type = "password";
					text.setPlaceholder("sk-...")
						.setValue(card.overrideApiKey || "")
						.onChange(async (value) => {
							card.overrideApiKey = value;
							await pluginRef.saveSettings();
						});
				});

			new Setting(overrideSection)
				.setName(t("API_URL_LABEL"))
				.addText((text) =>
					text
						.setPlaceholder(t("API_URL_PLACEHOLDER"))
						.setValue(
							card.overrideApiUrl ||
								pluginRef.settings.aiApiUrl
						)
						.onChange(async (value) => {
							card.overrideApiUrl = value;
							await pluginRef.saveSettings();
						})
				);

			new Setting(overrideSection)
				.setName(t("MODEL_LABEL"))
				.addText((text) =>
					text
						.setPlaceholder(t("MODEL_PLACEHOLDER"))
						.setValue(
							card.overrideModel || pluginRef.settings.aiModel
						)
						.onChange(async (value) => {
							card.overrideModel = value;
							await pluginRef.saveSettings();
						})
				);

			new Setting(overrideSection)
				.setName(t("MAX_TOKENS_LABEL"))
				.addSlider((slider) =>
					slider
						.setLimits(500, 4000, 100)
						.setValue(
							card.overrideMaxTokens ??
								pluginRef.settings.aiMaxTokens
						)
						.setDynamicTooltip()
						.onChange(async (value) => {
							card.overrideMaxTokens = value;
							await pluginRef.saveSettings();
						})
				);

			new Setting(overrideSection)
				.setName(t("TEMPERATURE_LABEL"))
				.addSlider((slider) =>
					slider
						.setLimits(0, 1, 0.1)
						.setValue(
							card.overrideTemperature ??
								pluginRef.settings.aiTemperature
						)
						.setDynamicTooltip()
						.onChange(async (value) => {
							card.overrideTemperature = value;
							await pluginRef.saveSettings();
						})
				);
		}

		new Setting(bodyEl)
			.setName(t("OVERRIDE_SWITCH_LABEL"))
			.setDesc(t("OVERRIDE_SWITCH_DESC"))
			.addToggle((toggle) =>
				toggle.setValue(useOverride).onChange(async (value) => {
					card.overrideEnabled = value;
					useOverride = value;
					if (!value) {
						card.overrideProvider = undefined;
						card.overrideApiUrl = undefined;
						card.overrideApiKey = undefined;
						card.overrideModel = undefined;
						card.overrideMaxTokens = undefined;
						card.overrideTemperature = undefined;
					}
					await plugin.saveSettings();
					renderOverride();
				})
			);

		const overrideSection = bodyEl.createDiv({
			cls: "mtt-override-section",
		});
		renderOverride();
	});
}
