import { Setting } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";

interface DefaultPromptsSettingsContext {
	plugin: MyTextTools;
	containerEl: HTMLElement;
}

export function renderDefaultPromptsSettingsTab(
	ctx: DefaultPromptsSettingsContext
) {
	const { plugin, containerEl } = ctx;

	const ensureConfig = (id: string) => {
		if (!plugin.settings.aiTools) plugin.settings.aiTools = {};
		if (!plugin.settings.aiTools[id])
			plugin.settings.aiTools[id] = {};
		return plugin.settings.aiTools[id]!;
	};

	const renderToolConfig = (
		titleKey: string,
		id: string,
		showLang = false
	) => {
		containerEl.createEl("h3", { text: t(titleKey as any) });

		new Setting(containerEl)
			.setName(t("SETTING_PROMPT"))
			.addTextArea((ta) => {
				ta.inputEl.rows = 4;
				ta.inputEl.style.width = "400px";
				const cfg = ensureConfig(id);
				ta.setPlaceholder(
					t(
						id === "ai-extract-keypoints"
							? "PROMPT_EXTRACT_KEYPOINTS"
							: id === "ai-summarize"
							? "PROMPT_SUMMARIZE"
							: id === "ai-translate"
							? "PROMPT_TRANSLATE"
							: "PROMPT_POLISH"
					) as any
				);
				ta.setValue(
					cfg.prompt ||
						(t(
							id === "ai-extract-keypoints"
								? "PROMPT_EXTRACT_KEYPOINTS"
								: id === "ai-summarize"
								? "PROMPT_SUMMARIZE"
								: id === "ai-translate"
								? "PROMPT_TRANSLATE"
								: "PROMPT_POLISH"
						) as string)
				);
				ta.onChange(async (value) => {
					cfg.prompt = value;
					plugin.settings.aiTools[id] = cfg;
					await plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(t("SETTING_SYSTEM_PROMPT"))
			.addTextArea((ta) => {
				ta.inputEl.rows = 4;
				ta.inputEl.style.width = "400px";
				const cfg = ensureConfig(id);
				ta.setPlaceholder(
					t(
						id === "ai-extract-keypoints"
							? "SYSTEM_PROMPT_EXTRACT"
							: id === "ai-summarize"
							? "SYSTEM_PROMPT_SUMMARIZE"
							: id === "ai-translate"
							? "SYSTEM_PROMPT_TRANSLATE"
							: "SYSTEM_PROMPT_POLISH"
					) as any
				);
				ta.setValue(
					cfg.systemPrompt ||
						(t(
							id === "ai-extract-keypoints"
								? "SYSTEM_PROMPT_EXTRACT"
								: id === "ai-summarize"
								? "SYSTEM_PROMPT_SUMMARIZE"
								: id === "ai-translate"
								? "SYSTEM_PROMPT_TRANSLATE"
								: "SYSTEM_PROMPT_POLISH"
						) as string)
				);
				ta.onChange(async (value) => {
					cfg.systemPrompt = value;
					plugin.settings.aiTools[id] = cfg;
					await plugin.saveSettings();
				});
			});

		if (showLang) {
			new Setting(containerEl)
				.setName(t("SETTING_TARGET_LANG"))
				.addText((text) => {
					const cfg = ensureConfig(id);
					text.setPlaceholder(t("TARGET_LANG_PLACEHOLDER"));
					text.setValue(
						cfg.targetLanguage ?? t("TARGET_LANG_PLACEHOLDER")
					);
					text.onChange(async (value) => {
						cfg.targetLanguage = value;
						plugin.settings.aiTools[id] = cfg;
						await plugin.saveSettings();
					});
				});
		}
	};

	renderToolConfig("TOOL_AI_EXTRACT_KEYPOINTS", "ai-extract-keypoints");
	renderToolConfig("TOOL_AI_SUMMARIZE", "ai-summarize");
	renderToolConfig("TOOL_AI_TRANSLATE", "ai-translate", true);
	renderToolConfig("TOOL_AI_POLISH", "ai-polish");
}

