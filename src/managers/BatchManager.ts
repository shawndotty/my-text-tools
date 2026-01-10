import { Editor, Notice, MarkdownView } from "obsidian";
import {
	MyTextToolsPlugin,
	BatchOperation,
	BatchProcess,
	SettingsState,
	ToolType,
} from "../types";
import { t } from "../lang/helpers";
import { processText as processTextCore } from "../utils/textProcessors";
import { ScriptManager } from "./ScriptManager";
import { AIManager } from "./AIManager";

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
		const settings = this.getEffectiveSettingsForScope(
			op.settingsSnapshot,
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
				settings
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
				scope
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
				settings
			);
		}

		return processTextCore(op.toolId as ToolType, text, settings);
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
