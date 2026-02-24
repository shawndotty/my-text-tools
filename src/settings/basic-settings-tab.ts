import { App, ButtonComponent, Setting, setIcon, Notice } from "obsidian";
import { t } from "lang/helpers";
import MyTextTools from "../main";
import { BUILTIN_TOOLS } from "../types";
import { IconPickerModal } from "../UI/modals/IconPickerModal";
import { GithubService } from "../services/github-service";
import { GiteeService } from "../services/gitee-service";
import { Utils } from "../utils";

interface BasicSettingsContext {
	app: App;
	plugin: MyTextTools;
	containerEl: HTMLElement;
}

export function renderBasicSettingsTab(ctx: BasicSettingsContext) {
	const { app, plugin, containerEl } = ctx;

	const currentVersion = plugin.manifest.version;
	const githubRepoUrl = "https://github.com/shawndotty/my-text-tools";
	const giteeRepoUrl = "https://gitee.com/johnnylearns/my-text-tools";

	new Setting(containerEl)
		.setName(t("Update Source"))
		.setDesc(t("Choose where to check for updates"))
		.addDropdown((dropdown) => {
			dropdown
				.addOption("github", "GitHub")
				.addOption("gitee", "Gitee")
				.setValue(plugin.settings.updateSource || "gitee")
				.onChange(async (value) => {
					plugin.settings.updateSource = value as "github" | "gitee";
					await plugin.saveSettings();
				});
		});

	const versionSetting = new Setting(containerEl)
		.setName(`${t("Current Version")}: ${currentVersion}`)
		.setDesc(t("Check for Updates"))
		.addButton((button) => {
			button.setButtonText(t("Check for Updates")).onClick(async () => {
				const source = plugin.settings.updateSource || "gitee";
				const repoUrl =
					source === "github" ? githubRepoUrl : giteeRepoUrl;

				button.setButtonText(t("Checking..."));
				button.setDisabled(true);

				const latestVersion =
					source === "github"
						? await GithubService.getLatestPluginVersion(repoUrl)
						: await GiteeService.getLatestPluginVersion(repoUrl);

				button.setDisabled(false);

				if (!latestVersion) {
					button.setButtonText(t("Check for Updates"));
					new Notice(t("Failed to check for updates"));
					return;
				}

				const cmp = Utils.compareVersions(
					currentVersion,
					latestVersion,
				);

				if (cmp === 0) {
					versionSetting.setDesc(t("Already up to date"));
					button.setButtonText(t("Check for Updates"));
				} else if (cmp < 0) {
					versionSetting.setDesc(
						`${t("Update available")}: ${latestVersion}`,
					);
					versionSetting.controlEl.empty();
					versionSetting.addButton((b) => {
						b.setButtonText(t("Start Update"))
							.setCta()
							.onClick(async () => {
								b.setButtonText(t("Updating..."));
								b.setDisabled(true);
								if (source === "github") {
									await GithubService.installPluginFrom(
										app,
										repoUrl,
									);
								} else {
									await GiteeService.installPluginFrom(
										app,
										repoUrl,
									);
								}
								b.setButtonText(t("Updated"));
								b.setDisabled(false);
								new Notice(
									t("Restart Obsidian to apply changes"),
								);
							});
					});
				} else {
					versionSetting.setDesc(
						t("You are using a development version"),
					);
					button.setButtonText(t("Check for Updates"));
				}
			});
		});

	containerEl.createEl("p", {
		text: t("BasicSettingsDesc" as any),
		cls: "setting-item-description",
	});

	BUILTIN_TOOLS.forEach((tool) => {
		const setting = new Setting(containerEl).setName(
			t(tool.nameKey as any),
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
								"input[type='text']",
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
							".clickable-icon",
						) as HTMLElement;
						if (btnEl && value) setIcon(btnEl, value);
						(plugin as any).refreshCustomRibbons?.();
					}),
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
					}),
			);
	});
}
