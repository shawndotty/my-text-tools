import { Notice } from "obsidian";
import { MyTextToolsSettings } from "../settings";
import { t } from "../lang/helpers";

export interface AIChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface AIResponse {
	content: string;
	error?: string;
}

/**
 * AI 服务类，封装与 AI API 的交互
 */
export class AIService {
	private settings: MyTextToolsSettings;

	constructor(settings: MyTextToolsSettings) {
		this.settings = settings;
	}

	/**
	 * 检查配置是否完整
	 */
	isConfigured(): boolean {
		return !!(
			this.settings.aiApiKey &&
			this.settings.aiApiUrl &&
			this.settings.aiModel
		);
	}

	/**
	 * 调用 AI API 处理文本
	 */
	async processText(
		prompt: string,
		userText: string,
		systemPrompt?: string
	): Promise<AIResponse> {
		if (!this.isConfigured()) {
			return {
				content: "",
				error: t("AI_CONFIG_INCOMPLETE"),
			};
		}

		const messages: AIChatMessage[] = [];

		// 添加系统提示（如果有）
		if (systemPrompt) {
			messages.push({
				role: "system",
				content: systemPrompt,
			});
		}

		// 添加用户消息
		const userMessage = prompt
			? `${prompt}\n\n待处理文本：\n${userText}`
			: userText;
		messages.push({
			role: "user",
			content: userMessage,
		});

		try {
			const response = await fetch(this.settings.aiApiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.settings.aiApiKey}`,
				},
				body: JSON.stringify({
					model: this.settings.aiModel,
					messages: messages,
					max_tokens: this.settings.aiMaxTokens,
					temperature: this.settings.aiTemperature,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage =
					errorData.error?.message ||
					t("AI_API_ERROR", [
						String(response.status),
						response.statusText,
					]);
				return {
					content: "",
					error: errorMessage,
				};
			}

			const data = await response.json();
			const content = data.choices?.[0]?.message?.content || "";

			if (!content) {
				return {
					content: "",
					error: t("AI_EMPTY_RESPONSE"),
				};
			}

			return {
				content: content.trim(),
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : t("AI_UNKNOWN_ERROR");
			return {
				content: "",
				error: t("AI_NETWORK_ERROR", [errorMessage]),
			};
		}
	}

	/**
	 * 提取要点
	 */
	async extractKeyPoints(text: string): Promise<AIResponse> {
		const prompt = t("PROMPT_EXTRACT_KEYPOINTS");
		const systemPrompt = t("SYSTEM_PROMPT_EXTRACT");
		return this.processText(prompt, text, systemPrompt);
	}

	/**
	 * 总结文本
	 */
	async summarize(text: string): Promise<AIResponse> {
		const prompt = t("PROMPT_SUMMARIZE");
		const systemPrompt = t("SYSTEM_PROMPT_SUMMARIZE");
		return this.processText(prompt, text, systemPrompt);
	}

	/**
	 * 翻译文本
	 */
	async translate(
		text: string,
		targetLanguage: string = "英文"
	): Promise<AIResponse> {
		const prompt = t("PROMPT_TRANSLATE", [targetLanguage]);
		const systemPrompt = t("SYSTEM_PROMPT_TRANSLATE");
		return this.processText(prompt, text, systemPrompt);
	}

	/**
	 * 润色文本
	 */
	async polish(text: string): Promise<AIResponse> {
		const prompt = t("PROMPT_POLISH");
		const systemPrompt = t("SYSTEM_PROMPT_POLISH");
		return this.processText(prompt, text, systemPrompt);
	}
}
