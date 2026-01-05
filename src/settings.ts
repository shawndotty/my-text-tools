import { App, PluginSettingTab, Setting } from "obsidian";
import MyTextTools from "./main";

export interface MyTextToolsSettings {
	mySetting: string;
	// AI 配置
	aiProvider: "deepseek" | "openai" | "custom";
	aiApiKey: string;
	aiApiUrl: string; // 自定义 API URL
	aiModel: string; // 模型名称，如 deepseek-chat
	aiMaxTokens: number; // 最大 token 数
	aiTemperature: number; // 温度参数 0-1
}

export const DEFAULT_SETTINGS: MyTextToolsSettings = {
	mySetting: "default",
	aiProvider: "deepseek",
	aiApiKey: "",
	aiApiUrl: "https://api.deepseek.com/v1/chat/completions",
	aiModel: "deepseek-chat",
	aiMaxTokens: 2000,
	aiTemperature: 0.7,
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

		containerEl.createEl("h2", { text: "AI 配置" });

		// AI 服务提供商选择
		new Setting(containerEl)
			.setName("AI 服务提供商")
			.setDesc("选择要使用的 AI 服务")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("deepseek", "Deepseek")
					.addOption("openai", "OpenAI")
					.addOption("custom", "自定义")
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
			.setName("API Key")
			.setDesc("输入您的 AI 服务 API Key")
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
				.setName("API URL")
				.setDesc("自定义 API 端点地址")
				.addText((text) =>
					text
						.setPlaceholder(
							"https://api.example.com/v1/chat/completions"
						)
						.setValue(this.plugin.settings.aiApiUrl)
						.onChange(async (value) => {
							this.plugin.settings.aiApiUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// 模型名称
		new Setting(containerEl)
			.setName("模型名称")
			.setDesc("要使用的模型名称")
			.addText((text) =>
				text
					.setPlaceholder("deepseek-chat")
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						this.plugin.settings.aiModel = value;
						await this.plugin.saveSettings();
					})
			);

		// 最大 Token 数
		new Setting(containerEl)
			.setName("最大 Token 数")
			.setDesc("生成内容的最大 token 数量")
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
			.setName("温度参数")
			.setDesc("控制输出的随机性 (0-1，值越大越随机)")
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
}
