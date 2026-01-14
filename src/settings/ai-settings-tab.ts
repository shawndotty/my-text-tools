import { Setting } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";

interface AISettingsContext {
	plugin: MyTextTools;
	containerEl: HTMLElement;
	refresh: () => void;
}

export function renderAISettingsTab(ctx: AISettingsContext) {
	const { plugin, containerEl, refresh } = ctx;

	new Setting(containerEl)
		.setName(t("AI_PROVIDER_LABEL"))
		.setDesc(t("AI_PROVIDER_DESC"))
		.addDropdown((dropdown) =>
			dropdown
				.addOption("deepseek", "Deepseek")
				.addOption("openai", "OpenAI")
				.addOption("custom", t("PROVIDER_OPTION_CUSTOM"))
				.setValue(plugin.settings.aiProvider)
				.onChange(async (value) => {
					plugin.settings.aiProvider = value as any;
					if (value === "deepseek") {
						plugin.settings.aiApiUrl =
							"https://api.deepseek.com/v1/chat/completions";
						plugin.settings.aiModel = "deepseek-chat";
					} else if (value === "openai") {
						plugin.settings.aiApiUrl =
							"https://api.openai.com/v1/chat/completions";
						plugin.settings.aiModel = "gpt-3.5-turbo";
					}
					await plugin.saveSettings();
					refresh();
				})
		);

	new Setting(containerEl)
		.setName(t("API_KEY_LABEL"))
		.setDesc(t("API_KEY_DESC"))
		.addText((text) => {
			text.setValue(plugin.settings.aiApiKey);
			text.inputEl.type = "password";
			text.setPlaceholder(t("API_KEY_PLACEHOLDER"));
			text.onChange(async (value) => {
				plugin.settings.aiApiKey = value;
				await plugin.saveSettings();
			});
		});

	if (plugin.settings.aiProvider === "custom") {
		new Setting(containerEl)
			.setName(t("API_URL_LABEL"))
			.setDesc(t("API_URL_DESC"))
			.addText((text) =>
				text
					.setPlaceholder(t("API_URL_PLACEHOLDER"))
					.setValue(plugin.settings.aiApiUrl)
					.onChange(async (value) => {
						plugin.settings.aiApiUrl = value;
						await plugin.saveSettings();
					})
			);
	}

	new Setting(containerEl)
		.setName(t("MODEL_LABEL"))
		.setDesc(t("MODEL_DESC"))
		.addText((text) =>
			text
				.setPlaceholder(t("MODEL_PLACEHOLDER"))
				.setValue(plugin.settings.aiModel)
				.onChange(async (value) => {
					plugin.settings.aiModel = value;
					await plugin.saveSettings();
				})
		);

	new Setting(containerEl)
		.setName(t("MAX_TOKENS_LABEL"))
		.setDesc(t("MAX_TOKENS_DESC"))
		.addSlider((slider) =>
			slider
				.setLimits(500, 4000, 100)
				.setValue(plugin.settings.aiMaxTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					plugin.settings.aiMaxTokens = value;
					await plugin.saveSettings();
				})
		);

	new Setting(containerEl)
		.setName(t("TEMPERATURE_LABEL"))
		.setDesc(t("TEMPERATURE_DESC"))
		.addSlider((slider) =>
			slider
				.setLimits(0, 1, 0.1)
				.setValue(plugin.settings.aiTemperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					plugin.settings.aiTemperature = value;
					await plugin.saveSettings();
				})
		);
}

