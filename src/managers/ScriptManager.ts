import { App, Notice, MarkdownView } from "obsidian";
import { IMyTextToolsPlugin } from "../types";
import { CustomScript, ScriptParam } from "../settings";
import { ScriptExecutor } from "../utils/scriptExecutor";
import { t } from "../lang/helpers";
import { MyTextToolsView, MY_TEXT_TOOLS_VIEW } from "../UI/view";

export class ScriptManager {
	plugin: IMyTextToolsPlugin;
	app: App;

	constructor(plugin: IMyTextToolsPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	private getWorkbenchView(): MyTextToolsView | null {
		const leaf = this.app.workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];
		const view = leaf?.view;
		return view instanceof MyTextToolsView ? view : null;
	}

	getCustomScriptParams(script: CustomScript): Record<string, any> {
		if (!script.params || script.params.length === 0) return {};
		const view = this.getWorkbenchView();
		return script.params.reduce((acc: Record<string, any>, p) => {
			const key = `custom:${script.id}:${p.key}`;
			const val = view ? (view.settingsState as any)[key] : undefined;
			let finalVal = val !== undefined ? val : p.default;

			if (p.type === "text" && typeof finalVal === "string") {
				finalVal = finalVal
					.replace(/\\n/g, "\n")
					.replace(/\\t/g, "\t")
					.replace(/\\r/g, "\r");
			}

			if (p.type === "array" && typeof finalVal === "string") {
				finalVal = finalVal.split(/\r?\n/);
			}

			acc[p.key] = finalVal;
			return acc;
		}, {} as Record<string, any>);
	}

	async applyCustomScriptToText(
		script: CustomScript,
		text: string,
		scope: "note" | "selection"
	): Promise<string> {
		const selection = scope === "selection" ? text : "";
		const usesSelectionOnly =
			/\bselection\b/.test(script.code) && !/\btext\b/.test(script.code);
		if (usesSelectionOnly && !selection) {
			new Notice(t("NOTICE_NO_SELECTION"));
			return text;
		}

		const executor = new ScriptExecutor(this.app);
		const params = this.getCustomScriptParams(script);
		const result = await executor.execute(
			script.code,
			text,
			selection,
			params
		);
		return typeof result === "string" ? result : text;
	}

	async runCustomScript(scriptId: string) {
		const script = this.plugin.settings.customScripts?.find(
			(s) => s.id === scriptId
		);
		if (!script) {
			new Notice(t("NOTICE_SCRIPT_NOT_FOUND"));
			return;
		}

		// 获取当前内容和选区
		let content = "";
		let selection = "";
		let updateCallback: (newText: string) => void = () => {};

		const mttLeaf =
			this.app.workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (
			mttLeaf &&
			mttLeaf.view &&
			mttLeaf.view instanceof MyTextToolsView
		) {
			const view = mttLeaf.view as MyTextToolsView;
			content = view.content;

			const currentSelection = view.getEditorSelection();
			if (currentSelection) {
				selection = currentSelection.text;
			} else {
				selection = "";
			}

			updateCallback = (newText: string) => {
				view.historyManager.pushToHistory(view.content);
				if (currentSelection) {
					view.replaceEditorSelection(newText);
					view.updateHistoryUI();
				} else {
					view.content = newText;
					view.render();
					view.updateHistoryUI();
				}
			};
		} else if (activeView && activeView.editor) {
			const editor = activeView.editor;
			content = editor.getValue();
			selection = editor.getSelection();
			updateCallback = (newText: string) => {
				if (selection) {
					editor.replaceSelection(newText);
				} else {
					editor.setValue(newText);
				}
			};
		} else {
			new Notice(t("NOTICE_NO_EDITOR"));
			return;
		}

		const usesSelectionOnly =
			/\bselection\b/.test(script.code) && !/\btext\b/.test(script.code);
		const hasSelection = !!selection;
		if (!hasSelection && usesSelectionOnly) {
			new Notice(t("NOTICE_NO_SELECTION"));
			return;
		}

		try {
			const executor = new ScriptExecutor(this.app);
			let params: Record<string, any> = {};
			if (script.params && script.params.length > 0) {
				// We reuse the logic from getCustomScriptParams but we need to pass view manually or use the helper
				// The helper getCustomScriptParams uses getWorkbenchView() internally which is fine.
				// However, the original code in main.ts had some logic duplication for params inside runCustomScript.
				// Let's reuse getCustomScriptParams.
				params = this.getCustomScriptParams(script);
			}
			const result = await executor.execute(
				script.code,
				content,
				selection,
				params
			);

			if (typeof result === "string") {
				updateCallback(result);
				new Notice(t("NOTICE_SCRIPT_SUCCESS"));
			}
		} catch (error: any) {
			console.error("Script execution failed:", error);
			new Notice(t("NOTICE_SCRIPT_ERROR").replace("{0}", error.message));
		}
	}
}
