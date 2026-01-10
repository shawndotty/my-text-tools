import { Notice, MarkdownView, App } from "obsidian";
import { IMyTextToolsPlugin, SettingsState, ToolType } from "../types";
import { MyTextToolsSettings, CustomAIAction } from "../settings";
import { AIService } from "../utils/aiService";
import { t } from "../lang/helpers";
import { MyTextToolsView, MY_TEXT_TOOLS_VIEW } from "../UI/view";

export class AIManager {
	plugin: IMyTextToolsPlugin;
	app: App;

	constructor(plugin: IMyTextToolsPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	private extractFrontmatterForAI(
		text: string,
		preserveFrontmatter: boolean
	) {
		if (!preserveFrontmatter) {
			return { frontmatter: "", body: text };
		}
		const fmMatch = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
		if (!fmMatch) {
			return { frontmatter: "", body: text };
		}
		return {
			frontmatter: fmMatch[0],
			body: text.substring(fmMatch[0].length),
		};
	}

	private extractHeaderForAI(text: string, preserveHeader: boolean) {
		if (!preserveHeader) {
			return { header: "", body: text };
		}
		const lines = text.split("\n");
		if (lines.length === 0 || !lines[0]?.trim()) {
			return { header: "", body: text };
		}
		return {
			header: lines[0]!,
			body: lines.slice(1).join("\n"),
		};
	}

	async applyBuiltInAIToolToText(
		toolId: ToolType,
		text: string,
		settings: SettingsState
	): Promise<string> {
		const aiService = new AIService(this.plugin.settings);
		if (!aiService.isConfigured()) {
			new Notice("❌ " + t("AI_CONFIG_INCOMPLETE"));
			return text;
		}

		const fm = this.extractFrontmatterForAI(
			text,
			settings.preserveFrontmatter
		);
		const header = this.extractHeaderForAI(
			fm.body,
			settings.preserveHeader
		);
		const textToProcess = header.body;

		if (!textToProcess.trim()) {
			new Notice("❌ " + t("NOTICE_NO_TEXT"));
			return text;
		}

		let result: { content: string; error?: string };
		switch (toolId) {
			case "ai-extract-keypoints":
				result = await aiService.extractKeyPoints(textToProcess);
				break;
			case "ai-summarize":
				result = await aiService.summarize(textToProcess);
				break;
			case "ai-translate":
				result = await aiService.translate(textToProcess);
				break;
			case "ai-polish":
				result = await aiService.polish(textToProcess);
				break;
			default:
				return text;
		}

		if (result.error) {
			new Notice("❌ " + t("NOTICE_AI_ERROR", [result.error]));
			return text;
		}

		let finalContent = result.content;
		if (settings.preserveHeader && header.header) {
			finalContent = header.header + "\n" + finalContent;
		}
		if (settings.preserveFrontmatter && fm.frontmatter) {
			finalContent = fm.frontmatter + finalContent;
		}
		return finalContent;
	}

	async applyCustomAIActionToText(
		action: CustomAIAction,
		text: string,
		settings: SettingsState
	): Promise<string> {
		const merged: MyTextToolsSettings = {
			...this.plugin.settings,
			aiProvider:
				action.overrideProvider ?? this.plugin.settings.aiProvider,
			aiApiUrl: action.overrideApiUrl ?? this.plugin.settings.aiApiUrl,
			aiApiKey: action.overrideApiKey ?? this.plugin.settings.aiApiKey,
			aiModel: action.overrideModel ?? this.plugin.settings.aiModel,
			aiMaxTokens:
				action.overrideMaxTokens ?? this.plugin.settings.aiMaxTokens,
			aiTemperature:
				action.overrideTemperature ??
				this.plugin.settings.aiTemperature,
		};

		const aiService = new AIService(merged);
		if (!aiService.isConfigured()) {
			new Notice("❌ " + t("AI_CONFIG_INCOMPLETE"));
			return text;
		}

		const fm = this.extractFrontmatterForAI(
			text,
			settings.preserveFrontmatter
		);
		const header = this.extractHeaderForAI(
			fm.body,
			settings.preserveHeader
		);
		const textToProcess = header.body;

		if (!textToProcess.trim()) {
			new Notice("❌ " + t("NOTICE_NO_TEXT"));
			return text;
		}

		const result = await aiService.processText(
			settings.customAiPrompt !== undefined
				? settings.customAiPrompt
				: action.prompt || "",
			textToProcess,
			settings.customAiSystemPrompt !== undefined
				? settings.customAiSystemPrompt
				: action.systemPrompt || ""
		);
		if (result.error) {
			new Notice("❌ " + t("NOTICE_AI_ERROR", [result.error]));
			return text;
		}

		let finalContent = result.content;
		if (settings.preserveHeader && header.header) {
			finalContent = header.header + "\n" + finalContent;
		}
		if (settings.preserveFrontmatter && fm.frontmatter) {
			finalContent = fm.frontmatter + finalContent;
		}
		return finalContent;
	}

	async runCustomAIAction(actionId: string) {
		const action =
			this.plugin.settings.customActions?.find(
				(a) => a.id === actionId
			) || null;
		if (!action) {
			new Notice(t("NOTICE_PROMPT_NOT_FOUND"));
			return;
		}

		const mttLeaf =
			this.app.workspace.getLeavesOfType(MY_TEXT_TOOLS_VIEW)[0];

		// 合并设置
		const merged: MyTextToolsSettings = {
			...this.plugin.settings,
			aiProvider:
				action.overrideProvider ?? this.plugin.settings.aiProvider,
			aiApiUrl: action.overrideApiUrl ?? this.plugin.settings.aiApiUrl,
			aiApiKey: action.overrideApiKey ?? this.plugin.settings.aiApiKey,
			aiModel: action.overrideModel ?? this.plugin.settings.aiModel,
			aiMaxTokens:
				action.overrideMaxTokens ?? this.plugin.settings.aiMaxTokens,
			aiTemperature:
				action.overrideTemperature ??
				this.plugin.settings.aiTemperature,
		};

		const aiService = new AIService(merged);
		// 情况一：优先工作台视图，支持保护与历史
		if (
			mttLeaf &&
			mttLeaf.view &&
			mttLeaf.view instanceof MyTextToolsView
		) {
			const view = mttLeaf.view as MyTextToolsView;
			view.showLoading(t("NOTICE_AI_PROCESSING"));
			const src = view.content || "";
			if (!src.trim()) {
				new Notice(t("NOTICE_NO_TEXT"));
				view.hideLoading();
				return;
			}
			view.historyManager.pushToHistory(view.content);

			let textToProcess = src;
			const fmMatch = textToProcess.match(
				/^---\n([\s\S]*?)\n---(?:\n|$)/
			);
			if (fmMatch && (view.settingsState as any).preserveFrontmatter) {
				textToProcess = textToProcess.substring(fmMatch[0].length);
			}
			const lines = textToProcess.split("\n");
			if (
				(view.settingsState as any).preserveHeader &&
				lines.length > 0
			) {
				textToProcess = lines.slice(1).join("\n");
			}

			const result = await aiService.processText(
				action.prompt || "",
				textToProcess,
				action.systemPrompt || ""
			);
			if (result.error) {
				new Notice(`❌ ${result.error}`);
				view.hideLoading();
				return;
			}
			let finalContent = result.content;
			if (fmMatch && (view.settingsState as any).preserveFrontmatter) {
				finalContent = fmMatch[0] + finalContent;
			}
			if (
				(view.settingsState as any).preserveHeader &&
				lines.length > 0 &&
				lines[0]?.trim()
			) {
				finalContent = lines[0] + "\n" + finalContent;
			}
			view.content = finalContent;
			view.render();
			view.hideLoading();
			new Notice("✅ " + t("NOTICE_AI_DONE"));
			return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		// 情况二：活动的 Markdown 编辑器
		if (activeView && activeView.editor) {
			const editor = activeView.editor;
			const selection = editor.getSelection();
			const useSelection =
				action.applyToSelection && selection && selection.length > 0;
			if (useSelection) {
				if (!selection.trim()) {
					new Notice(t("NOTICE_NO_TEXT"));
					return;
				}
				const result = await aiService.processText(
					action.prompt || "",
					selection,
					action.systemPrompt || ""
				);
				if (result.error) {
					new Notice("❌ " + t("NOTICE_AI_ERROR", [result.error]));
					return;
				}
				editor.replaceSelection(result.content);
				new Notice(t("NOTICE_AI_DONE"));
				return;
			}
			const fullText = editor.getValue();
			if (!fullText.trim()) {
				new Notice(t("NOTICE_NO_TEXT"));
				return;
			}
			let textToProcess = fullText;
			const fmMatch = textToProcess.match(
				/^---\n([\s\S]*?)\n---(?:\n|$)/
			);
			if (fmMatch) {
				textToProcess = textToProcess.substring(fmMatch[0].length);
			}
			const lines = textToProcess.split("\n");
			if (lines.length > 0) {
				textToProcess = lines.slice(1).join("\n");
			}
			const result = await aiService.processText(
				action.prompt || "",
				textToProcess,
				action.systemPrompt || ""
			);
			if (result.error) {
				new Notice("❌ " + t("NOTICE_AI_ERROR", [result.error]));
				return;
			}
			let finalContent = result.content;
			if (fmMatch) {
				finalContent = fmMatch[0] + finalContent;
			}
			if (lines.length > 0 && lines[0]?.trim()) {
				finalContent = lines[0] + "\n" + finalContent;
			}
			editor.setValue(finalContent);
			new Notice(t("NOTICE_AI_DONE"));
			return;
		}

		// 情况三：均不可用
		new Notice(t("NOTICE_NO_EDITOR"));
	}
}
