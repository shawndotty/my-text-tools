import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import MyTextTools from "./main";
import { TabbedSettings } from "UI/tabbed-settings";
import { t } from "lang/helpers";
import { BUILTIN_TOOLS, BatchProcess } from "./types";
import { AIGenerateScriptModal } from "./UI/modals/AIGenerateScriptModal";
import { AIService } from "./utils/aiService";

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

export interface CustomScript {
	id: string;
	name: string;
	description?: string;
	icon?: string;
	showInRibbon: boolean;
	code: string; // JavaScript code content
	params?: ScriptParam[];
}

export type ScriptParamType =
	| "text"
	| "number"
	| "boolean"
	| "select"
	| "array";

export interface ScriptParam {
	key: string;
	label?: string;
	type: ScriptParamType;
	default?: string | number | boolean;
	options?: string[];
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
	// 自定义 JS 脚本
	customScripts: CustomScript[];
	// 默认 AI 工具配置
	aiTools: Record<string, AIToolConfig>;
	customIcons: Record<string, string>;
	savedBatches: BatchProcess[];
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
	customScripts: [],
	aiTools: {},
	customIcons: {},
	savedBatches: [],
};

export class MyTextToolsSettingTab extends PluginSettingTab {
	plugin: MyTextTools;
	private expandedScripts: Set<string> = new Set();

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
			{
				title: "CustomScriptsSettings",
				renderMethod: (content: HTMLElement) =>
					this.renderCustomScriptsSettings(content),
			},
		];

		tabConfigs.forEach((config) => {
			const title =
				t(config.title as any) === config.title
					? config.title
					: t(config.title as any);
			tabbedSettings.addTab(title, config.renderMethod);
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

				.addText((text) =>
					text
						.setPlaceholder(tool.icon)
						.setValue(
							this.plugin.settings.customIcons?.[tool.id] || ""
						)
						.onChange(async (value) => {
							if (!this.plugin.settings.customIcons) {
								this.plugin.settings.customIcons = {};
							}
							this.plugin.settings.customIcons[tool.id] = value;
							await this.plugin.saveSettings();
							// 触发视图更新
							(this.plugin as any).refreshCustomRibbons?.();
						})
				)
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
				text.setPlaceholder(t("API_KEY_PLACEHOLDER"));
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
			containerEl.createEl("h3", { text: t(titleKey as any) });

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
						text.setPlaceholder(t("TARGET_LANG_PLACEHOLDER"));
						text.setValue(
							cfg.targetLanguage ?? t("TARGET_LANG_PLACEHOLDER")
						);
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

			const headerSetting = new Setting(cardContainer)
				.setName(`${t("PROMPT_GROUP_NAME")} ${idx + 1}`)
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

			const headerInfo = headerSetting.settingEl.querySelector(
				".setting-item-info"
			) as HTMLElement | null;
			const bodyEl = cardContainer.createDiv({ cls: "mtt-card-body" });
			let expanded = this.expandedScripts.has(card.id);
			const arrowEl = document.createElement("span");
			arrowEl.style.marginRight = "6px";
			if (headerInfo) headerInfo.prepend(arrowEl);
			const updateVisibility = () => {
				bodyEl.style.display = expanded ? "block" : "none";
				setIcon(arrowEl, expanded ? "chevron-down" : "chevron-right");
				if (expanded) {
					this.expandedScripts.add(card.id);
				} else {
					this.expandedScripts.delete(card.id);
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
				await this.plugin.saveSettings();
				(this.plugin as any).refreshCustomRibbons?.();
			};

			bodyEl.createEl("label", { text: t("ICON_PLACEHOLDER") });
			const iconInput = bodyEl.createEl("input", {
				type: "text",
				placeholder: t("ICON_PLACEHOLDER"),
				value: card.icon || "sparkles",
			});
			iconInput.style.width = "100%";
			iconInput.onchange = async (e) => {
				card.icon = (e.target as HTMLInputElement).value || "sparkles";
				await this.plugin.saveSettings();
				(this.plugin as any).refreshCustomRibbons?.();
			};

			bodyEl.createEl("label", { text: t("PROMPT_FIELD_LABEL") });
			bodyEl.createEl("p", {
				text: t("PROMPT_FIELD_DESC"),
				cls: "setting-item-description",
			});
			const promptArea = bodyEl.createEl("textarea");
			promptArea.rows = 4;
			promptArea.style.width = "100%";
			promptArea.placeholder = t("PROMPT_PLACEHOLDER") as string;
			promptArea.value = card.prompt || "";
			promptArea.onchange = async (e) => {
				card.prompt = (e.target as HTMLTextAreaElement).value;
				await this.plugin.saveSettings();
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
				await this.plugin.saveSettings();
			};

			new Setting(bodyEl)
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

			let useOverride =
				!!card.overrideEnabled ||
				!!card.overrideProvider ||
				!!card.overrideApiUrl ||
				!!card.overrideApiKey ||
				!!card.overrideModel ||
				card.overrideMaxTokens !== undefined ||
				card.overrideTemperature !== undefined;

			const pluginRef = this.plugin;
			function renderOverride() {
				// 运行时会在 overrideSection 初始化后才调用
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
						await this.plugin.saveSettings();
						renderOverride();
					})
				);

			const overrideSection = bodyEl.createDiv({
				cls: "mtt-override-section",
			});
			renderOverride();
		});
	}

	private renderCustomScriptsSettings(containerEl: HTMLElement) {
		containerEl.createEl("h3", {
			text: t("CUSTOM_SCRIPTS_TITLE"),
		});

		new Setting(containerEl)
			.setName(t("CUSTOM_SCRIPTS_MANAGE"))
			.setDesc(t("CUSTOM_SCRIPTS_DESC"))
			.addButton((btn) =>
				btn.setButtonText(t("BTN_ADD_SCRIPT")).onClick(async () => {
					const nextIndex =
						(this.plugin.settings.customScripts?.length || 0) + 1;
					const newScript: CustomScript = {
						id: `${Date.now()}`,
						name: `${t("SCRIPT_GROUP_NAME")} ${nextIndex}`,
						description: "",
						icon: "scroll",
						showInRibbon: true,
						code: "return selection.toUpperCase();",
						params: [],
					};
					this.plugin.settings.customScripts.push(newScript);
					await this.plugin.saveSettings();
					(this.plugin as any).refreshCustomRibbons?.();
					containerEl.empty();
					this.renderCustomScriptsSettings(containerEl);
				})
			);

		this.plugin.settings.customScripts.forEach((script, idx) => {
			const cardContainer = containerEl.createDiv({
				cls: "mtt-custom-card",
			});

			const headerSetting = new Setting(cardContainer)
				.setName(`${t("SCRIPT_GROUP_NAME")} ${idx + 1}`)
				.addToggle((toggle) =>
					toggle
						.setTooltip(t("TOGGLE_SHOW_IN_LEFT"))
						.setValue(script.showInRibbon)
						.onChange(async (value) => {
							script.showInRibbon = value;
							await this.plugin.saveSettings();
							(this.plugin as any).refreshCustomRibbons?.();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip(t("TOOLTIP_DELETE_SCRIPT"))
						.onClick(async () => {
							this.plugin.settings.customScripts =
								this.plugin.settings.customScripts.filter(
									(s) => s.id !== script.id
								);
							await this.plugin.saveSettings();
							(this.plugin as any).refreshCustomRibbons?.();
							containerEl.empty();
							this.renderCustomScriptsSettings(containerEl);
						})
				);

			const headerInfo = headerSetting.settingEl.querySelector(
				".setting-item-info"
			) as HTMLElement | null;
			const bodyEl = cardContainer.createDiv({ cls: "mtt-card-body" });
			let expanded = this.expandedScripts.has(script.id);
			const arrowEl = document.createElement("span");
			arrowEl.style.marginRight = "6px";
			if (headerInfo) headerInfo.prepend(arrowEl);
			const updateVisibility = () => {
				bodyEl.style.display = expanded ? "block" : "none";
				setIcon(arrowEl, expanded ? "chevron-down" : "chevron-right");
				if (expanded) {
					this.expandedScripts.add(script.id);
				} else {
					this.expandedScripts.delete(script.id);
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
				await this.plugin.saveSettings();
				(this.plugin as any).refreshCustomRibbons?.();
			};

			bodyEl.createEl("label", {
				text: t("ICON_PLACEHOLDER"),
			});
			const iconInput = bodyEl.createEl("input", {
				type: "text",
				placeholder: t("ICON_PLACEHOLDER"),
				value: script.icon || "scroll",
			});
			iconInput.style.width = "100%";
			iconInput.onchange = async (e) => {
				script.icon = (e.target as HTMLInputElement).value || "scroll";
				await this.plugin.saveSettings();
				(this.plugin as any).refreshCustomRibbons?.();
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
				await this.plugin.saveSettings();
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
				await this.plugin.saveSettings();
			};

			new Setting(bodyEl).addButton((btn) =>
				btn
					.setButtonText(t("BTN_GENERATE_SCRIPT_AI"))
					.setIcon("sparkles")
					.onClick(() => {
						const aiService = new AIService(this.plugin.settings);
						new AIGenerateScriptModal(
							this.app,
							aiService,
							async (code) => {
								script.code = code;
								codeArea.value = code;
								await this.plugin.saveSettings();
							}
						).open();
					})
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
						await this.plugin.saveSettings();
						containerEl.empty();
						this.renderCustomScriptsSettings(containerEl);
					})
				);

			(script.params || []).forEach((param, pIdx) => {
				const pCard = bodyEl.createDiv({ cls: "mtt-custom-card" });
				new Setting(pCard)
					.setName(`${t("PARAM_GROUP_NAME")} ${pIdx + 1}`)
					.addExtraButton((btn) =>
						btn.setIcon("trash").onClick(async () => {
							script.params = (script.params || []).filter(
								(_, i) => i !== pIdx
							);
							await this.plugin.saveSettings();
							containerEl.empty();
							this.renderCustomScriptsSettings(containerEl);
						})
					);

				const grid = pCard.createDiv();
				grid.style.display = "grid";
				grid.style.gridTemplateColumns = "1fr";
				grid.style.gap = "8px";

				// Key 字段组
				const keyContainer = grid.createDiv();
				keyContainer.style.display = "flex";
				keyContainer.style.alignItems = "center";
				keyContainer.style.justifyContent = "space-between";
				keyContainer.style.gap = "8px";
				const keyLabel = keyContainer.createEl("label", {
					text: t("PARAM_KEY_LABEL"),
				});
				const keyInput = keyContainer.createEl("input", {
					type: "text",
					value: param.key,
				});
				keyInput.onchange = async (e) => {
					param.key = (e.target as HTMLInputElement).value;
					await this.plugin.saveSettings();
				};

				// 标签字段组
				const labelContainer = grid.createDiv();
				labelContainer.style.display = "flex";
				labelContainer.style.alignItems = "center";
				labelContainer.style.justifyContent = "space-between";
				labelContainer.style.gap = "8px";
				const labelLabel = labelContainer.createEl("label", {
					text: t("PARAM_LABEL_LABEL"),
				});
				const labelInput = labelContainer.createEl("input", {
					type: "text",
					value: param.label || "",
				});
				labelInput.onchange = async (e) => {
					param.label = (e.target as HTMLInputElement).value;
					await this.plugin.saveSettings();
				};

				// 类型字段组
				const typeContainer = grid.createDiv();
				typeContainer.style.display = "flex";
				typeContainer.style.alignItems = "center";
				typeContainer.style.justifyContent = "space-between";
				typeContainer.style.gap = "8px";
				const typeLabel = typeContainer.createEl("label", {
					text: t("PARAM_TYPE_LABEL"),
				});
				const typeSelect = typeContainer.createEl("select");
				["text", "number", "boolean", "select", "array"].forEach(
					(opt) => {
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
					}
				);
				typeSelect.onchange = async (e) => {
					param.type = (e.target as HTMLSelectElement)
						.value as ScriptParamType;
					if (param.type !== "select") {
						param.options = undefined;
					}
					await this.plugin.saveSettings();
					containerEl.empty();
					this.renderCustomScriptsSettings(containerEl);
				};

				// 默认值字段组
				const defaultContainer = grid.createDiv();
				defaultContainer.style.display = "flex";
				defaultContainer.style.alignItems = "center";
				defaultContainer.style.justifyContent = "space-between";
				defaultContainer.style.gap = "8px";
				const defaultLabel = defaultContainer.createEl("label", {
					text: t("PARAM_DEFAULT_LABEL"),
				});
				let defaultInput: HTMLElement;
				if (param.type === "boolean") {
					const checkbox = defaultContainer.createEl("input", {
						type: "checkbox",
					});
					checkbox.checked = !!param.default;
					checkbox.onchange = async (e) => {
						param.default = (e.target as HTMLInputElement).checked;
						await this.plugin.saveSettings();
					};
					defaultInput = checkbox;
				} else if (param.type === "array") {
					const textarea = defaultContainer.createEl("textarea", {
						cls: "mtt-textarea-small",
					});
					textarea.rows = 3;
					textarea.value =
						param.default !== undefined
							? String(param.default)
							: "";
					textarea.onchange = async (e) => {
						const val = (e.target as HTMLTextAreaElement).value;
						param.default = val;
						await this.plugin.saveSettings();
					};
					defaultInput = textarea;
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
						param.default =
							param.type === "number" ? Number(val) : val;
						await this.plugin.saveSettings();
					};
					defaultInput = input;
				}

				// 选项字段组
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
					await this.plugin.saveSettings();
				};
				if (param.type !== "select") {
					optionsLabel.style.display = "none";
					optionsInput.style.display = "none";
					optionsInput.disabled = true;
				}
			});
		});
	}
}
