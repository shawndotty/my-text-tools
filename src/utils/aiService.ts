import { Notice } from "obsidian";
import { MyTextToolsSettings } from "../settings";

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
				error: "AI 配置不完整，请在设置中配置 API Key 和模型",
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
					`API 请求失败: ${response.status} ${response.statusText}`;
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
					error: "AI 返回了空内容",
				};
			}

			return {
				content: content.trim(),
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "未知错误";
			return {
				content: "",
				error: `网络请求失败: ${errorMessage}`,
			};
		}
	}

	/**
	 * 提取要点
	 */
	async extractKeyPoints(text: string): Promise<AIResponse> {
		const prompt = "请提取以下文本的要点，以列表形式输出，每个要点一行：";
		const systemPrompt =
			"你是一个专业的文本分析助手，擅长提取文本的核心要点。请用简洁、准确的语言概括要点。";
		return this.processText(prompt, text, systemPrompt);
	}

	/**
	 * 总结文本
	 */
	async summarize(text: string): Promise<AIResponse> {
		const prompt = "请对以下文本进行总结，要求简洁明了：";
		const systemPrompt =
			"你是一个专业的文本总结助手，擅长用简洁的语言概括文本的主要内容。";
		return this.processText(prompt, text, systemPrompt);
	}

	/**
	 * 翻译文本
	 */
	async translate(text: string, targetLanguage: string = "英文"): Promise<AIResponse> {
		const prompt = `请将以下文本翻译成${targetLanguage}：`;
		const systemPrompt =
			"你是一个专业的翻译助手，请准确、流畅地翻译文本，保持原文的语气和风格。";
		return this.processText(prompt, text, systemPrompt);
	}

	/**
	 * 润色文本
	 */
	async polish(text: string): Promise<AIResponse> {
		const prompt =
			"请对以下文本进行润色，使其更加流畅、专业，但保持原意不变：";
		const systemPrompt =
			"你是一个专业的文本润色助手，擅长改进文本的表达方式，使其更加清晰、专业。";
		return this.processText(prompt, text, systemPrompt);
	}
}

