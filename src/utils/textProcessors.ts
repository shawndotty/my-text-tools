import { Notice } from "obsidian";
import { t } from "../lang/helpers";
import { SettingsState, ToolType } from "../types";
import { toolRegistry } from "../tools/ToolRegistry";
import {
	RegexStrategy,
	RegexExtractStrategy,
	RemoveWhitespaceStrategy,
	DedupeStrategy,
	EmptyLineStrategy,
	AddWrapStrategy,
	RemoveStringStrategy,
	NumberListStrategy,
	LineBreakToolsStrategy,
	ExtractColumnStrategy,
	SwapColumnsStrategy,
	ExtractBetweenStrategy,
	WordFrequencyStrategy,
	ClearFormatStrategy,
	CombinationGeneratorStrategy,
} from "../tools/implementations";

/**
 * 文本处理器类
 * 负责处理各种文本转换操作 (Strategy Pattern Facade)
 */
export class TextProcessor {
	constructor() {
		this.registerStrategies();
	}

	private registerStrategies() {
		toolRegistry.register(new RegexStrategy());
		toolRegistry.register(new RegexExtractStrategy());
		toolRegistry.register(new RemoveWhitespaceStrategy());
		toolRegistry.register(new DedupeStrategy());
		toolRegistry.register(new EmptyLineStrategy());
		toolRegistry.register(new AddWrapStrategy());
		toolRegistry.register(new RemoveStringStrategy());
		toolRegistry.register(new NumberListStrategy());
		toolRegistry.register(new LineBreakToolsStrategy());
		toolRegistry.register(new ExtractColumnStrategy());
		toolRegistry.register(new SwapColumnsStrategy());
		toolRegistry.register(new ExtractBetweenStrategy());
		toolRegistry.register(new WordFrequencyStrategy());
		toolRegistry.register(new ClearFormatStrategy());
		toolRegistry.register(new CombinationGeneratorStrategy());
	}

	/**
	 * 处理文本的核心方法
	 */
	processText(
		type: ToolType,
		text: string,
		settings: SettingsState,
		hideNotice: boolean = false
	): string {
		const strategy = toolRegistry.get(type);

		// 如果找不到策略，可能是组合生成器或者特殊的，或者未实现
		// 组合生成器在旧代码中是独立的，但在新代码中已作为策略
		if (!strategy) {
			// Fallback for tools not yet migrated or simple join
			// But since we covered all built-in tools, this shouldn't happen for valid types
			return text;
		}

		let textToProcess = text;
		let extractedFrontmatter = "";
		let extractedHeader = "";

		// --- 第一层：保护 Frontmatter ---
		const fmResult = this.extractFrontmatter(
			textToProcess,
			settings.preserveFrontmatter
		);
		extractedFrontmatter = fmResult.frontmatter;
		textToProcess = fmResult.body;

		// --- 第二层：保护首行 ---
		let lines = textToProcess.split("\n");
		const headerResult = this.extractHeader(lines, settings.preserveHeader);
		extractedHeader = headerResult.header;
		// Re-join extraction result for the strategy, as strategy interface expects string
		textToProcess = headerResult.bodyLines.join("\n");

		// --- 执行具体策略 ---
		const processedBody = strategy.execute(textToProcess, settings, {
			hideNotice,
		});

		// 如果返回的是 Promise (目前都是同步的，但接口支持 Promise)
		if (processedBody instanceof Promise) {
			// This method is synchronous in signature.
			// We should technically update the signature to async, but that requires refactoring callers.
			// However, our current standard tools are synchronous.
			// For safety, we assume sync return for standard tools.
			// If async is needed, we need to refactor processText to async.
			// For now, cast.
			return text; // Should not happen with current implementations
		}

		// --- 最终三段式拼合 ---
		const result =
			extractedFrontmatter + extractedHeader + (processedBody as string);

		// 动态通知提示 (Skip messages)
		// Strategies handle their own "Done" notices.
		// We only handle "Skip" notices here if applicable.
		let noticeMsg = "";
		if (extractedFrontmatter && extractedHeader)
			noticeMsg = t("NOTICE_SKIP_FM_AND_HEADER");
		else if (extractedFrontmatter) noticeMsg = t("NOTICE_SKIP_FRONTMATTER");
		else if (extractedHeader) noticeMsg = t("NOTICE_SKIP_HEADER");

		if (noticeMsg && !hideNotice) {
			// Only show skip notice if strategy didn't error?
			// Ideally we queue notices.
			new Notice(noticeMsg);
		}

		return result;
	}

	// ========== 辅助方法：提取和保护 ==========

	/**
	 * 提取和保护 Frontmatter
	 */
	private extractFrontmatter(
		text: string,
		preserveFrontmatter: boolean
	): { frontmatter: string; body: string } {
		if (!preserveFrontmatter) {
			return { frontmatter: "", body: text };
		}

		const fmMatch = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
		if (fmMatch) {
			return {
				frontmatter: fmMatch[0],
				body: text.substring(fmMatch[0].length),
			};
		}
		return { frontmatter: "", body: text };
	}

	/**
	 * 提取和保护首行
	 */
	private extractHeader(
		lines: string[],
		preserveHeader: boolean
	): { header: string; bodyLines: string[] } {
		if (!preserveHeader || lines.length === 0) {
			return { header: "", bodyLines: lines };
		}

		return {
			header: lines[0] + "\n",
			bodyLines: lines.slice(1),
		};
	}

	/**
	 * 组合生成器处理 (Keep for backward compatibility signature if needed, though mostly used via processText)
	 */
	processCombinationGenerator(inputs: string[]): string {
		const strategy = toolRegistry.get("combination-generator");
		if (strategy) {
			// Mock settings for standalone call
			const dummySettings: any = { combinationInputs: inputs };
			return strategy.execute("", dummySettings, {
				hideNotice: true,
			}) as string;
		}
		return "";
	}
}

// ========== 向后兼容的导出 ==========

/**
 * 创建并导出默认的文本处理器实例
 */
export const textProcessor = new TextProcessor();

/**
 * 向后兼容的函数导出
 * @deprecated 请使用 TextProcessor 类或 textProcessor 实例
 */
export function processText(
	type: ToolType,
	text: string,
	settings: SettingsState,
	hideNotice: boolean = false
): string {
	return textProcessor.processText(type, text, settings, hideNotice);
}

/**
 * 向后兼容的函数导出
 * @deprecated 请使用 TextProcessor 类
 */
export function processCombinationGenerator(inputs: string[]): string {
	return textProcessor.processCombinationGenerator(inputs);
}
