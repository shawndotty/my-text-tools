import { App, PluginSettingTab, Setting } from "obsidian";
import MyTextTools from "./main";

export interface MyTextToolsSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: MyTextToolsSettings = {
	mySetting: "default",
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

		new Setting(containerEl)
			.setName("Settings #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
