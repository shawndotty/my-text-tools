import { App, PluginSettingTab } from "obsidian";
import MyTextTools from "../main";
import { TabbedSettings } from "UI/tabbed-settings";
import { t } from "lang/helpers";
import { renderBatchProcessSettingsTab } from "./batch-process-settings-tab";
import { renderBasicSettingsTab } from "./basic-settings-tab";
import { renderAISettingsTab } from "./ai-settings-tab";
import { renderDefaultPromptsSettingsTab } from "./default-prompts-settings-tab";
import { renderUserPromptsSettingsTab } from "./user-prompts-settings-tab";
import { renderCustomScriptsSettingsTab } from "./custom-scripts-settings-tab";

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
			{
				title: "BatchProcessSettings",
				renderMethod: (content: HTMLElement) =>
					this.renderBatchProcessSettings(content),
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

	private renderBatchProcessSettings(containerEl: HTMLElement) {
		renderBatchProcessSettingsTab({
			app: this.app,
			plugin: this.plugin,
			containerEl,
		});
	}

	private renderBasicSettings(containerEl: HTMLElement) {
		renderBasicSettingsTab({
			app: this.app,
			plugin: this.plugin,
			containerEl,
		});
	}

	private renderAISettings(containerEl: HTMLElement) {
		renderAISettingsTab({
			plugin: this.plugin,
			containerEl,
			refresh: () => this.display(),
		});
	}

	private renderDefaultPromptsSettings(containerEl: HTMLElement) {
		renderDefaultPromptsSettingsTab({
			plugin: this.plugin,
			containerEl,
		});
	}

	private renderUserPromptsSettings(containerEl: HTMLElement) {
		renderUserPromptsSettingsTab({
			app: this.app,
			plugin: this.plugin,
			containerEl,
			expandedScripts: this.expandedScripts,
			refresh: () => {
				containerEl.empty();
				this.renderUserPromptsSettings(containerEl);
			},
		});
	}

	private renderCustomScriptsSettings(containerEl: HTMLElement) {
		renderCustomScriptsSettingsTab({
			app: this.app,
			plugin: this.plugin,
			containerEl,
			expandedScripts: this.expandedScripts,
			refresh: () => {
				containerEl.empty();
				this.renderCustomScriptsSettings(containerEl);
			},
		});
	}
}
