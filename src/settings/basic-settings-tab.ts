import { App, ButtonComponent, Setting, setIcon } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";
import { BUILTIN_TOOLS } from "../types";
import { IconPickerModal } from "../UI/modals/IconPickerModal";

interface BasicSettingsContext {
	app: App;
	plugin: MyTextTools;
	containerEl: HTMLElement;
}

export function renderBasicSettingsTab(ctx: BasicSettingsContext) {
	const { app, plugin, containerEl } = ctx;

	containerEl.createEl("p", {
		text: t("BasicSettingsDesc" as any),
		cls: "setting-item-description",
	});

	BUILTIN_TOOLS.forEach((tool) => {
		const setting = new Setting(containerEl).setName(
			t(tool.nameKey as any)
		);

		setting
			.addExtraButton((btn) => {
				const currentIcon =
					plugin.settings.customIcons?.[tool.id] || tool.icon;

				btn.setIcon(currentIcon)
					.setTooltip(t("MODAL_ICON_PICKER_TITLE"), {
						placement: "left",
						delay: 300,
					})
					.onClick(() => {
						new IconPickerModal(app, async (newIcon) => {
							if (!plugin.settings.customIcons) {
								plugin.settings.customIcons = {};
							}
							plugin.settings.customIcons[tool.id] = newIcon;
							await plugin.saveSettings();
							btn.setIcon(newIcon);
							const inputEl = setting.controlEl.querySelector(
								"input[type='text']"
							) as HTMLInputElement;
							if (inputEl) inputEl.value = newIcon;
							(plugin as any).refreshCustomRibbons?.();
						}).open();
					});
			})
			.addText((text) =>
				text
					.setPlaceholder(tool.icon)
					.setValue(plugin.settings.customIcons?.[tool.id] || "")
					.onChange(async (value) => {
						if (!plugin.settings.customIcons) {
							plugin.settings.customIcons = {};
						}
						plugin.settings.customIcons[tool.id] = value;
						await plugin.saveSettings();
						const btnEl = setting.controlEl.querySelector(
							".clickable-icon"
						) as HTMLElement;
						if (btnEl && value) setIcon(btnEl, value);
						(plugin as any).refreshCustomRibbons?.();
					})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(plugin.settings.enabledTools?.[tool.id] ?? true)
					.onChange(async (value) => {
						if (!plugin.settings.enabledTools) {
							plugin.settings.enabledTools = {};
						}
						plugin.settings.enabledTools[tool.id] = value;
						await plugin.saveSettings();
						(plugin as any).refreshCustomRibbons?.();
					})
			);
	});
}
