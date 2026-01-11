import {
	Editor,
	Notice,
	MarkdownView,
	TFile,
	TAbstractFile,
	Menu,
	TFolder,
} from "obsidian";
import {
	MyTextToolsPlugin,
	BatchOperation,
	BatchProcess,
	SettingsState,
	ToolType,
	migrateToNestedSettings,
} from "../types";
import { t } from "../lang/helpers";
import { processText as processTextCore } from "../utils/textProcessors";
import { ScriptManager } from "./ScriptManager";
import { AIManager } from "./AIManager";
import { ConfirmModal } from "../UI/modals/ConfirmModal";

export class BatchManager {
	plugin: MyTextToolsPlugin;
	scriptManager: ScriptManager;
	aiManager: AIManager;

	constructor(
		plugin: MyTextToolsPlugin,
		scriptManager: ScriptManager,
		aiManager: AIManager
	) {
		this.plugin = plugin;
		this.scriptManager = scriptManager;
		this.aiManager = aiManager;
		this.registerFileMenuEvent();
	}

	async syncBatchShortcuts() {
		const enabledIds = this.getEnabledBatchShortcutIds();
		let changed = false;
		for (const id of enabledIds) {
			const batch = this.plugin.settings.savedBatches.find(
				(b) => b.id === id
			);
			if (!batch) {
				this.removeBatchCommands(id);
				delete this.plugin.settings.batchShortcuts[id];
				changed = true;
				continue;
			}
			this.removeBatchCommands(id);
			this.registerBatchCommands(batch);
		}
		if (changed) {
			await this.plugin.saveSettings();
		}
	}

	getEnabledBatchShortcutIds(): string[] {
		return Object.entries(this.plugin.settings.batchShortcuts || {})
			.filter(([, enabled]) => !!enabled)
			.map(([id]) => id);
	}

	isBatchShortcutEnabled(batchId: string): boolean {
		return !!this.plugin.settings.batchShortcuts?.[batchId];
	}

	async enableBatchShortcut(batchId: string) {
		if (!this.plugin.settings.batchShortcuts)
			this.plugin.settings.batchShortcuts = {};
		this.plugin.settings.batchShortcuts[batchId] = true;
		await this.plugin.saveSettings();
		await this.refreshBatchShortcut(batchId);
	}

	async disableBatchShortcut(batchId: string) {
		if (!this.plugin.settings.batchShortcuts) return;
		delete this.plugin.settings.batchShortcuts[batchId];
		this.removeBatchCommands(batchId);
		await this.plugin.saveSettings();
	}

	async refreshBatchShortcut(batchId: string) {
		if (!this.isBatchShortcutEnabled(batchId)) return;
		const batch = this.plugin.settings.savedBatches.find(
			(b) => b.id === batchId
		);
		if (!batch) {
			await this.disableBatchShortcut(batchId);
			return;
		}
		this.removeBatchCommands(batchId);
		this.registerBatchCommands(batch);
	}

	private registerFileMenuEvent() {
		// Event for single file or when file-menu is triggered
		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"file-menu",
				(menu: Menu, file: TAbstractFile) => {
					const enabledIds = this.getEnabledBatchShortcutIds();
					if (enabledIds.length === 0) return;

					const batches = enabledIds
						.map((id) =>
							this.plugin.settings.savedBatches.find(
								(b) => b.id === id
							)
						)
						.filter((b): b is BatchProcess => !!b);
					if (batches.length === 0) return;

					// Check if we can find multiple selected files via DOM (fallback)
					const selectedFiles = this.getSelectedFiles(file);

					// If we found multiple files via DOM, use them
					// But if it's just the single file context, use that
					if (selectedFiles.length > 0) {
						menu.addSeparator();
						menu.addItem((item) => {
							item.setTitle(t("MENU_BATCH_SHORTCUTS_LABEL"))
								.setIcon("zap")
								.setIsLabel(true);
						});

						for (const batch of batches) {
							menu.addItem((item) => {
								item.setTitle(
									t("MENU_BATCH_RUN_FILES", [
										batch.name,
										String(selectedFiles.length),
									])
								)
									.setIcon("zap")
									.onClick(async () => {
										await this.runBatchOnFiles(
											batch.id,
											selectedFiles
										);
									});
							});
						}
					}

					// Folder Context
					if (file instanceof TFolder) {
						menu.addSeparator();
						menu.addItem((item) => {
							item.setTitle(t("MENU_BATCH_SHORTCUTS_LABEL"))
								.setIcon("zap")
								.setIsLabel(true);
						});

						for (const batch of batches) {
							// 1. Current folder only
							menu.addItem((item) => {
								item.setTitle(
									t("MENU_BATCH_RUN_FOLDER", [batch.name])
								)
									.setIcon("folder")
									.onClick(async () => {
										const files = this.getFilesInFolder(
											file,
											false
										);
										if (files.length === 0) return;

										new ConfirmModal(
											this.plugin.app,
											t("CONFIRM_BATCH_FOLDER_TITLE"),
											t("CONFIRM_BATCH_FOLDER_DESC", [
												batch.name,
												String(files.length),
											]),
											async () => {
												await this.runBatchOnFiles(
													batch.id,
													files
												);
											}
										).open();
									});
							});

							// 2. Recursive
							menu.addItem((item) => {
								item.setTitle(
									t("MENU_BATCH_RUN_FOLDER_RECURSIVE", [
										batch.name,
									])
								)
									.setIcon("folder-open")
									.onClick(async () => {
										const files = this.getFilesInFolder(
											file,
											true
										);
										if (files.length === 0) return;

										new ConfirmModal(
											this.plugin.app,
											t("CONFIRM_BATCH_FOLDER_TITLE"),
											t("CONFIRM_BATCH_FOLDER_DESC", [
												batch.name,
												String(files.length),
											]),
											async () => {
												await this.runBatchOnFiles(
													batch.id,
													files
												);
											}
										).open();
									});
							});
						}
					}
				}
			)
		);

		// Event for multiple files (files-menu)
		this.plugin.registerEvent(
			(this.plugin.app.workspace as any).on(
				"files-menu",
				(menu: Menu, files: TAbstractFile[]) => {
					const enabledIds = this.getEnabledBatchShortcutIds();
					if (enabledIds.length === 0) return;

					const batches = enabledIds
						.map((id) =>
							this.plugin.settings.savedBatches.find(
								(b) => b.id === id
							)
						)
						.filter((b): b is BatchProcess => !!b);
					if (batches.length === 0) return;

					const validFiles = files.filter(
						(f) => f instanceof TFile
					) as TFile[];
					if (validFiles.length === 0) return;

					menu.addSeparator();
					menu.addItem((item) => {
						item.setTitle(t("MENU_BATCH_SHORTCUTS_LABEL"))
							.setIcon("zap")
							.setIsLabel(true);
					});

					for (const batch of batches) {
						menu.addItem((item) => {
							item.setTitle(
								t("MENU_BATCH_RUN_FILES", [
									batch.name,
									String(validFiles.length),
								])
							)
								.setIcon("zap")
								.onClick(async () => {
									await this.runBatchOnFiles(
										batch.id,
										validFiles
									);
								});
						});
					}
				}
			)
		);
	}

	private getFilesInFolder(folder: TFolder, recursive: boolean): TFile[] {
		let files: TFile[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile) {
				if (child.extension === "md") {
					files.push(child);
				}
			} else if (child instanceof TFolder) {
				if (recursive) {
					files = files.concat(this.getFilesInFolder(child, true));
				}
			}
		}

		return files;
	}

	private getSelectedFiles(activeFile: TAbstractFile): TFile[] {
		const fileExplorerLeaf =
			this.plugin.app.workspace.getLeavesOfType("file-explorer")[0];
		if (!fileExplorerLeaf) {
			return activeFile instanceof TFile ? [activeFile] : [];
		}

		const fileExplorer = fileExplorerLeaf.view as any;
		if (!fileExplorer.fileItems) {
			return activeFile instanceof TFile ? [activeFile] : [];
		}

		const selectedFiles: TFile[] = [];
		for (const path in fileExplorer.fileItems) {
			const item = fileExplorer.fileItems[path];
			if (
				item.selfEl &&
				item.selfEl.classList.contains("is-selected") &&
				item.file instanceof TFile
			) {
				selectedFiles.push(item.file);
			}
		}

		// If the context file is in the selection, use the selection.
		// Otherwise (e.g. right-clicked a link or a file outside selection), use the context file.
		if (
			activeFile instanceof TFile &&
			!selectedFiles.some((f) => f.path === activeFile.path)
		) {
			return [activeFile];
		}

		if (selectedFiles.length > 0) {
			return selectedFiles;
		}

		if (activeFile instanceof TFile) {
			return [activeFile];
		}

		return [];
	}

	async runBatchOnFiles(batchId: string, files: TFile[]) {
		const batch = this.plugin.settings.savedBatches.find(
			(b) => b.id === batchId
		);
		if (!batch) {
			new Notice(t("NOTICE_BATCH_NOT_FOUND"));
			return;
		}

		new Notice(t("NOTICE_PROCESSING_FILES", [String(files.length)]));

		let successCount = 0;
		for (const file of files) {
			try {
				const content = await this.plugin.app.vault.read(file);
				let newContent = content;

				for (const op of batch.operations) {
					newContent = await this.applyBatchOperationToText(
						op,
						newContent,
						"note"
					);
				}

				if (newContent !== content) {
					await this.plugin.app.vault.modify(file, newContent);
					successCount++;
				}
			} catch (e) {
				console.error(`Failed to process file ${file.path}`, e);
			}
		}

		new Notice(
			t("NOTICE_BATCH_APPLIED_FILES", [
				String(successCount),
				String(files.length),
			])
		);
	}

	private getBatchCommandIds(batchId: string) {
		return {
			note: `batch-${batchId}-note`,
			selection: `batch-${batchId}-selection`,
		};
	}

	private removeBatchCommands(batchId: string) {
		const ids = this.getBatchCommandIds(batchId);
		try {
			(this.plugin as any).removeCommand(ids.note);
		} catch {}
		try {
			(this.plugin as any).removeCommand(ids.selection);
		} catch {}
	}

	private registerBatchCommands(batch: BatchProcess) {
		const ids = this.getBatchCommandIds(batch.id);

		this.plugin.addCommand({
			id: ids.note,
			name: t("COMMAND_BATCH_RUN_NOTE", [batch.name]),
			editorCallback: async (editor) => {
				await this.runBatchShortcut(batch.id, "note", editor);
			},
		});

		this.plugin.addCommand({
			id: ids.selection,
			name: t("COMMAND_BATCH_RUN_SELECTION", [batch.name]),
			editorCheckCallback: (checking, editor) => {
				if (!editor.somethingSelected()) return false;
				if (!checking) {
					void this.runBatchShortcut(batch.id, "selection", editor);
				}
				return true;
			},
		});
	}

	private getEffectiveSettingsForScope(
		settings: SettingsState,
		scope: "note" | "selection"
	): SettingsState {
		if (scope === "note") return settings;
		return {
			...settings,
			preserveFrontmatter: false,
			preserveHeader: false,
		};
	}

	private async applyBatchOperationToText(
		op: BatchOperation,
		text: string,
		scope: "note" | "selection"
	): Promise<string> {
		const migratedSettings = migrateToNestedSettings(op.settingsSnapshot);
		const settings = this.getEffectiveSettingsForScope(
			migratedSettings,
			scope
		);

		if (op.toolId.startsWith("custom-ai:")) {
			const id = op.toolId.split(":")[1]!;
			const action =
				this.plugin.settings.customActions?.find((a) => a.id === id) ||
				null;
			if (!action) {
				new Notice(t("NOTICE_PROMPT_NOT_FOUND"));
				return text;
			}
			return await this.aiManager.applyCustomAIActionToText(
				action,
				text,
				settings,
				true
			);
		}

		if (op.toolId.startsWith("custom-script:")) {
			const id = op.toolId.split(":")[1]!;
			const script =
				this.plugin.settings.customScripts?.find((s) => s.id === id) ||
				null;
			if (!script) {
				new Notice(t("NOTICE_SCRIPT_NOT_FOUND"));
				return text;
			}
			return await this.scriptManager.applyCustomScriptToText(
				script,
				text,
				scope,
				true
			);
		}

		if (
			op.toolId === "ai-extract-keypoints" ||
			op.toolId === "ai-summarize" ||
			op.toolId === "ai-translate" ||
			op.toolId === "ai-polish"
		) {
			return await this.aiManager.applyBuiltInAIToolToText(
				op.toolId as ToolType,
				text,
				settings,
				true
			);
		}

		return processTextCore(op.toolId as ToolType, text, settings, true);
	}

	async runBatchShortcut(
		batchId: string,
		scope: "note" | "selection",
		editor?: Editor
	) {
		const batch = this.plugin.settings.savedBatches.find(
			(b) => b.id === batchId
		);
		if (!batch) {
			new Notice(t("NOTICE_BATCH_NOT_FOUND"));
			await this.disableBatchShortcut(batchId);
			return;
		}

		const activeEditor =
			editor ||
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (!activeEditor) {
			new Notice(t("NOTICE_NO_EDITOR"));
			return;
		}

		if (scope === "selection" && !activeEditor.somethingSelected()) {
			new Notice(t("NOTICE_NO_SELECTION"));
			return;
		}

		let text =
			scope === "selection"
				? activeEditor.getSelection()
				: activeEditor.getValue();

		for (const op of batch.operations) {
			text = await this.applyBatchOperationToText(op, text, scope);
		}

		if (scope === "selection") {
			activeEditor.replaceSelection(text);
		} else {
			activeEditor.setValue(text);
		}

		new Notice(t("NOTICE_BATCH_APPLIED"));
	}
}

