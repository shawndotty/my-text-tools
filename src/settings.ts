import { App, PluginSettingTab, Setting } from "obsidian";
import MyTextTools from "./main";
import { TabbedSettings } from "UI/tabbed-settings";
import { t } from "lang/helpers";
import { BUILTIN_TOOLS } from "./types";

export interface CustomAIAction {
	id: string;
	name: string;
	icon?: string;
	showInRibbon: boolean;
	prompt: string;
	systemPrompt?: string;
	applyToSelection: boolean;
	// 可选覆盖全局 AI 参数
	overrideEnabled?: boolean;
	overrideProvider?: "deepseek" | "openai" | "custom";
	overrideApiKey?: string;
	overrideApiUrl?: string;
	overrideModel?: string;
	overrideMaxTokens?: number;
	overrideTemperature?: number;
}

export interface MyTextToolsSettings {
	mySetting: string;
	// 工具可见性配置
	enabledTools: Record<string, boolean>;
	// AI 配置
	aiProvider: "deepseek" | "openai" | "custom";
	aiApiKey: string;
	aiApiUrl: string; // 自定义 API URL
	aiModel: string; // 模型名称，如 deepseek-chat
	aiMaxTokens: number; // 最大 token 数
	aiTemperature: number; // 温度参数 0-1
	// 自定义 AI 动作卡片
	customActions: CustomAIAction[];
	// 默认 AI 工具配置
	aiTools: Record<string, AIToolConfig>;
}

export interface AIToolConfig {
	prompt?: string;
	systemPrompt?: string;
	targetLanguage?: string; // 仅用于翻译
}

export const DEFAULT_SETTINGS: MyTextToolsSettings = {
	mySetting: "default",
	enabledTools: BUILTIN_TOOLS.reduce((acc, tool) => {
		acc[tool.id] = true;
		return acc;
	}, {} as Record<string, boolean>),
	aiProvider: "deepseek",
	aiApiKey: "",
	aiApiUrl: "https://api.deepseek.com/v1/chat/completions",
	aiModel: "deepseek-chat",
	aiMaxTokens: 2000,
	aiTemperature: 0.7,
	customActions: [],
	aiTools: {},
};

export class MyTextToolsSettingTab extends PluginSettingTab {
	plugin: MyTextTools;

	constructor(app: App, plugin: MyTextTools) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const tabbedSettings = new TabbedSettings(containerEl);

		const tabConfigs = [
			{
				title: "BasicSettings",
				renderMethod: (content: HTMLElement) =>
					this.renderBasicSettings(content),
			},
			{
				title: "AISettings",
				renderMethod: (content: HTMLElement) =>
					this.renderAISettings(content),
			},
			{
				title: "DefaultPromptsSettings",
				renderMethod: (content: HTMLElement) =>
					this.renderDefaultPromptsSettings(content),
			},
			{
				title: "UserPromptsSettings",
				renderMethod: (content: HTMLElement) =>
					this.renderUserPromptsSettings(content),
			},
		];

		tabConfigs.forEach((config) => {
			tabbedSettings.addTab(t(config.title as any), config.renderMethod);
		});
	}

	private renderBasicSettings(containerEl: HTMLElement) {
		containerEl.createEl("p", {
			text: t("BasicSettingsDesc" as any),
			cls: "setting-item-description",
		});

		BUILTIN_TOOLS.forEach((tool) => {
			new Setting(containerEl)
				.setName(t(tool.nameKey as any))
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.enabledTools?.[tool.id] ?? true
						)
						.onChange(async (value) => {
							if (!this.plugin.settings.enabledTools) {
								this.plugin.settings.enabledTools = {};
							}
							this.plugin.settings.enabledTools[tool.id] = value;
							await this.plugin.saveSettings();
							// 触发视图更新
							(this.plugin as any).refreshCustomRibbons?.();
						})
				);
		});
	}

	private renderAISettings(containerEl: HTMLElement) {
		// AI 服务提供商选择
		new Setting(containerEl)
			.setName(t("AI_PROVIDER_LABEL"))
			.setDesc(t("AI_PROVIDER_DESC"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("deepseek", "Deepseek")
					.addOption("openai", "OpenAI")
					.addOption("custom", t("PROVIDER_OPTION_CUSTOM"))
					.setValue(this.plugin.settings.aiProvider)
					.onChange(async (value) => {
						this.plugin.settings.aiProvider = value as any;
						// 根据提供商设置默认 URL
						if (value === "deepseek") {
							this.plugin.settings.aiApiUrl =
								"https://api.deepseek.com/v1/chat/completions";
							this.plugin.settings.aiModel = "deepseek-chat";
						} else if (value === "openai") {
							this.plugin.settings.aiApiUrl =
								"https://api.openai.com/v1/chat/completions";
							this.plugin.settings.aiModel = "gpt-3.5-turbo";
						}
						await this.plugin.saveSettings();
						this.display(); // 重新渲染以更新 UI
					})
			);

		// API Key
		new Setting(containerEl)
			.setName(t("API_KEY_LABEL"))
			.setDesc(t("API_KEY_DESC"))
			.addText((text) => {
				text.setValue(this.plugin.settings.aiApiKey);
				text.inputEl.type = "password";
				text.setPlaceholder("sk-...");
				text.onChange(async (value) => {
					this.plugin.settings.aiApiKey = value;
					await this.plugin.saveSettings();
				});
			});

		// API URL（仅自定义提供商显示）
		if (this.plugin.settings.aiProvider === "custom") {
			new Setting(containerEl)
				.setName(t("API_URL_LABEL"))
				.setDesc(t("API_URL_DESC"))
				.addText((text) =>
					text
						.setPlaceholder(t("API_URL_PLACEHOLDER"))
						.setValue(this.plugin.settings.aiApiUrl)
						.onChange(async (value) => {
							this.plugin.settings.aiApiUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// 模型名称
		new Setting(containerEl)
			.setName(t("MODEL_LABEL"))
			.setDesc(t("MODEL_DESC"))
			.addText((text) =>
				text
					.setPlaceholder(t("MODEL_PLACEHOLDER"))
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value;
						await this.plugin.saveSettings();
					})
			);

		// 最大 Token 数
		new Setting(containerEl)
			.setName(t("MAX_TOKENS_LABEL"))
			.setDesc(t("MAX_TOKENS_DESC"))
			.addSlider((slider) =>
				slider
					.setLimits(500, 4000, 100)
					.setValue(this.plugin.settings.aiMaxTokens)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.aiMaxTokens = value;
						await this.plugin.saveSettings();
					})
			);

		// 温度参数
		new Setting(containerEl)
			.setName(t("TEMPERATURE_LABEL"))
			.setDesc(t("TEMPERATURE_DESC"))
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.1)
					.setValue(this.plugin.settings.aiTemperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.aiTemperature = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderDefaultPromptsSettings(containerEl: HTMLElement) {
		const ensureConfig = (id: string) => {
			if (!this.plugin.settings.aiTools)
				this.plugin.settings.aiTools = {};
			if (!this.plugin.settings.aiTools[id])
				this.plugin.settings.aiTools[id] = {};
			return this.plugin.settings.aiTools[id]!;
		};

		const renderToolConfig = (
			titleKey: string,
			id: string,
			showLang = false
		) => {
			containerEl.createEl("h5", { text: t(titleKey as any) });

			// Prompt
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
						this.plugin.settings.aiTools[id] = cfg;
						await this.plugin.saveSettings();
					});
				});

			// System Prompt
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
						this.plugin.settings.aiTools[id] = cfg;
						await this.plugin.saveSettings();
					});
				});

			// Target Language (translate only)
			if (showLang) {
				new Setting(containerEl)
					.setName(t("SETTING_TARGET_LANG"))
					.addText((text) => {
						const cfg = ensureConfig(id);
						text.setPlaceholder("English");
						text.setValue(cfg.targetLanguage ?? "English");
						text.onChange(async (value) => {
							cfg.targetLanguage = value;
							this.plugin.settings.aiTools[id] = cfg;
							await this.plugin.saveSettings();
						});
					});
			}
		};

		renderToolConfig("TOOL_AI_EXTRACT_KEYPOINTS", "ai-extract-keypoints");
		renderToolConfig("TOOL_AI_SUMMARIZE", "ai-summarize");
		renderToolConfig("TOOL_AI_TRANSLATE", "ai-translate", true);
		renderToolConfig("TOOL_AI_POLISH", "ai-polish");
	}

	private renderUserPromptsSettings(containerEl: HTMLElement) {
		const header = containerEl.createEl("h3", {
			text: t("CUSTOM_PROMPTS_TITLE"),
		});

		// 新增卡片按钮
		new Setting(containerEl)
			.setName(t("CUSTOM_PROMPTS_MANAGE"))
			.setDesc(t("CUSTOM_PROMPTS_DESC"))
			.addButton((btn) =>
				btn.setButtonText(t("BTN_ADD_PROMPT")).onClick(async () => {
					const nextIndex =
						(this.plugin.settings.customActions?.length || 0) + 1;
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
					this.plugin.settings.customActions.push(newCard);
					await this.plugin.saveSettings();
					// 重建左侧工具栏
					(this.plugin as any).refreshCustomRibbons?.();
					// 仅重绘当前标签页内容，避免回到第一个标签
					containerEl.empty();
					this.renderUserPromptsSettings(containerEl);
				})
			);

		// 渲染现有卡片
		this.plugin.settings.customActions.forEach((card, idx) => {
			const cardContainer = containerEl.createDiv({
				cls: "mtt-custom-card",
			});

			new Setting(cardContainer)
				.setName(`${t("PROMPT_GROUP_NAME")} ${idx + 1}`)
				.setDesc(t("PROMPT_NAME_AND_ICON"))
				.addText((text) =>
					text
						.setPlaceholder(t("PROMPT_NAME_PLACEHOLDER"))
						.setValue(card.name)
						.onChange(async (value) => {
							card.name = value;
							await this.plugin.saveSettings();
							(this.plugin as any).refreshCustomRibbons?.();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder(t("ICON_PLACEHOLDER"))
						.setValue(card.icon || "sparkles")
						.onChange(async (value) => {
							card.icon = value || "sparkles";
							await this.plugin.saveSettings();
							(this.plugin as any).refreshCustomRibbons?.();
						})
				)
				.addToggle((toggle) =>
					toggle
						.setTooltip(t("TOGGLE_SHOW_IN_LEFT"))
						.setValue(card.showInRibbon)
						.onChange(async (value) => {
							card.showInRibbon = value;
							await this.plugin.saveSettings();
							(this.plugin as any).refreshCustomRibbons?.();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip(t("TOOLTIP_DELETE_PROMPT"))
						.onClick(async () => {
							this.plugin.settings.customActions =
								this.plugin.settings.customActions.filter(
									(c) => c.id !== card.id
								);
							await this.plugin.saveSettings();
							(this.plugin as any).refreshCustomRibbons?.();
							containerEl.empty();
							this.renderUserPromptsSettings(containerEl);
						})
				);

			new Setting(cardContainer)
				.setName(t("PROMPT_FIELD_LABEL"))
				.setDesc(t("PROMPT_FIELD_DESC"))
				.addTextArea((ta) => {
					ta.inputEl.rows = 4;
					ta.setPlaceholder(t("PROMPT_PLACEHOLDER"));
					ta.setValue(card.prompt || "");
					ta.onChange(async (value) => {
						card.prompt = value;
						await this.plugin.saveSettings();
					});
				});

			new Setting(cardContainer)
				.setName(t("SYSTEM_PROMPT_LABEL"))
				.setDesc(t("SYSTEM_PROMPT_DESC"))
				.addTextArea((ta) => {
					ta.inputEl.rows = 3;
					ta.setPlaceholder(t("SYSTEM_PROMPT_PLACEHOLDER"));
					ta.setValue(card.systemPrompt || "");
					ta.onChange(async (value) => {
						card.systemPrompt = value;
						await this.plugin.saveSettings();
					});
				});

			new Setting(cardContainer)
				.setName(t("APPLY_SCOPE_LABEL"))
				.setDesc(t("APPLY_SCOPE_DESC"))
				.addToggle((toggle) =>
					toggle
						.setValue(card.applyToSelection)
						.onChange(async (value) => {
							card.applyToSelection = value;
							await this.plugin.saveSettings();
						})
				);

			// 覆盖参数开关
			let useOverride =
				!!card.overrideEnabled ||
				!!card.overrideProvider ||
				!!card.overrideApiUrl ||
				!!card.overrideApiKey ||
				!!card.overrideModel ||
				card.overrideMaxTokens !== undefined ||
				card.overrideTemperature !== undefined;
			new Setting(cardContainer)
				.setName(t("OVERRIDE_SWITCH_LABEL"))
				.setDesc(t("OVERRIDE_SWITCH_DESC"))
				.addToggle((toggle) =>
					toggle.setValue(useOverride).onChange(async (value) => {
						card.overrideEnabled = value;
						if (!value) {
							card.overrideProvider = undefined;
							card.overrideApiUrl = undefined;
							card.overrideApiKey = undefined;
							card.overrideModel = undefined;
							card.overrideMaxTokens = undefined;
							card.overrideTemperature = undefined;
							await this.plugin.saveSettings();
							containerEl.empty();
							this.renderUserPromptsSettings(containerEl);
						} else {
							await this.plugin.saveSettings();
							containerEl.empty();
							this.renderUserPromptsSettings(containerEl);
						}
					})
				);

			if (useOverride) {
				new Setting(cardContainer)
					.setName(t("PROVIDER_LABEL"))
					.addDropdown((dropdown) =>
						dropdown
							.addOption("deepseek", "Deepseek")
							.addOption("openai", "OpenAI")
							.addOption("custom", t("PROVIDER_OPTION_CUSTOM"))
							.setValue(
								card.overrideProvider ||
									this.plugin.settings.aiProvider
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
								await this.plugin.saveSettings();
							})
					);

				new Setting(cardContainer)
					.setName(t("API_KEY_LABEL"))
					.addText((text) => {
						text.inputEl.type = "password";
						text.setPlaceholder("sk-...")
							.setValue(card.overrideApiKey || "")
							.onChange(async (value) => {
								card.overrideApiKey = value;
								await this.plugin.saveSettings();
							});
					});

				new Setting(cardContainer)
					.setName(t("API_URL_LABEL"))
					.addText((text) =>
						text
							.setPlaceholder(t("API_URL_PLACEHOLDER"))
							.setValue(
								card.overrideApiUrl ||
									this.plugin.settings.aiApiUrl
							)
							.onChange(async (value) => {
								card.overrideApiUrl = value;
								await this.plugin.saveSettings();
							})
					);

				new Setting(cardContainer)
					.setName(t("MODEL_LABEL"))
					.addText((text) =>
						text
							.setPlaceholder(t("MODEL_PLACEHOLDER"))
							.setValue(
								card.overrideModel ||
									this.plugin.settings.aiModel
							)
							.onChange(async (value) => {
								card.overrideModel = value;
								await this.plugin.saveSettings();
							})
					);

				new Setting(cardContainer)
					.setName(t("MAX_TOKENS_LABEL"))
					.addSlider((slider) =>
						slider
							.setLimits(500, 4000, 100)
							.setValue(
								card.overrideMaxTokens ??
									this.plugin.settings.aiMaxTokens
							)
							.setDynamicTooltip()
							.onChange(async (value) => {
								card.overrideMaxTokens = value;
								await this.plugin.saveSettings();
							})
					);

				new Setting(cardContainer)
					.setName(t("TEMPERATURE_LABEL"))
					.addSlider((slider) =>
						slider
							.setLimits(0, 1, 0.1)
							.setValue(
								card.overrideTemperature ??
									this.plugin.settings.aiTemperature
							)
							.setDynamicTooltip()
							.onChange(async (value) => {
								card.overrideTemperature = value;
								await this.plugin.saveSettings();
							})
					);
			}
		});
	}
}
