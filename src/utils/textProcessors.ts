import { Notice } from "obsidian";
import { t } from "../lang/helpers";
import { SettingsState, ToolType } from "../types";

/**
 * 提取和保护 Frontmatter
 */
export function extractFrontmatter(
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
export function extractHeader(
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
 * 处理文本的核心函数
 */
export function processText(
	type: ToolType,
	text: string,
	settings: SettingsState
): string {
	let textToProcess = text;
	let extractedFrontmatter = "";
	let extractedHeader = "";

	// --- 第一层：保护 Frontmatter ---
	const fmResult = extractFrontmatter(textToProcess, settings.preserveFrontmatter);
	extractedFrontmatter = fmResult.frontmatter;
	textToProcess = fmResult.body;

	// --- 第二层：保护首行 ---
	let lines = textToProcess.split("\n");
	const headerResult = extractHeader(lines, settings.preserveHeader);
	extractedHeader = headerResult.header;
	lines = headerResult.bodyLines;

	// --- 执行具体的工具逻辑 ---
	let processedBody = "";

	switch (type) {
		case "dedupe":
			processedBody = processDedupe(lines, settings.dedupeIncludeEmpty);
			new Notice(t("NOTICE_DEDUPE"));
			break;
		case "empty-line":
			processedBody = processEmptyLine(lines, settings.emptyLineMode);
			new Notice(
				settings.emptyLineMode === "all"
					? t("NOTICE_EMPTY_LINE")
					: t("NOTICE_EMPTY_LINE_MERGED")
			);
			break;
		case "regex":
			processedBody = processRegex(
				textToProcess,
				settings.findText,
				settings.replaceText
			);
			break;
		case "add-wrap":
			processedBody = processAddWrap(lines, settings.prefix, settings.suffix);
			new Notice(t("NOTICE_WRAP_DONE"));
			break;
		case "remove-string":
			processedBody = processRemoveString(
				lines,
				settings.filterText,
				settings.filterMode,
				settings.filterCase,
				settings.filterRegex
			);
			break;
		case "extract-column":
			processedBody = processExtractColumn(
				lines,
				settings.columnDelimiter,
				settings.customDelimiter,
				settings.columnNumber
			);
			break;
		case "swap-columns":
			processedBody = processSwapColumns(
				lines,
				settings.columnDelimiterSC,
				settings.customDelimiterSC,
				settings.swapCol1,
				settings.swapCol2
			);
			break;
		case "word-frequency":
			processedBody = processWordFrequency(
				textToProcess,
				settings.minWordLength,
				settings.includeNumbers,
				settings.sortOrder
			);
			break;
		case "number-list":
			processedBody = processNumberList(
				lines,
				settings.startNumber,
				settings.stepNumber,
				settings.listSeparator,
				settings.listPrefix
			);
			new Notice(t("NOTICE_NUMBER_DONE"));
			break;
		case "extract-between":
			processedBody = processExtractBetween(
				textToProcess,
				settings.extractStart,
				settings.extractEnd,
				settings.extractRegex
			);
			break;
		case "remove-whitespace":
			processedBody = processRemoveWhitespace(
				textToProcess,
				settings.wsCompress,
				settings.wsTrim,
				settings.wsAll,
				settings.wsTabs
			);
			new Notice(t("NOTICE_WS_DONE"));
			break;
		case "line-break-tools":
			processedBody = processLineBreakTools(
				textToProcess,
				settings.lbTrigger,
				settings.lbAction,
				settings.lbRegex
			);
			break;
		case "clear-format":
			processedBody = processClearFormat(
				textToProcess,
				settings.clearBold,
				settings.clearItalic,
				settings.clearHighlight,
				settings.clearStrikethrough,
				settings.clearCode,
				settings.clearLinks
			);
			new Notice(t("NOTICE_CLEAR_FORMAT_DONE"));
			break;
		default:
			processedBody = lines.join("\n");
	}

	// --- 最终三段式拼合 ---
	const result = extractedFrontmatter + extractedHeader + processedBody;

	// 动态通知提示
	let noticeMsg = t("NOTICE_PROCESS_DONE");
	if (extractedFrontmatter && extractedHeader)
		noticeMsg = t("NOTICE_SKIP_FM_AND_HEADER");
	else if (extractedFrontmatter) noticeMsg = t("NOTICE_SKIP_FRONTMATTER");
	else if (extractedHeader) noticeMsg = t("NOTICE_SKIP_HEADER");

	if (type !== "regex" && type !== "extract-between") {
		new Notice(noticeMsg);
	}

	return result;
}

// ========== 各个处理函数的实现 ==========

function processDedupe(lines: string[], includeEmpty: boolean): string {
	if (includeEmpty) {
		// 经典模式：所有行参与去重（包括空行也会被合并为剩一行）
		return Array.from(new Set(lines)).join("\n");
	} else {
		// 智能模式：保护空行
		const seen = new Set();
		const result: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed === "") {
				// 如果是空行，直接放入结果，不参与去重检测
				result.push(line);
			} else {
				// 如果是非空行，进行重复检测
				if (!seen.has(line)) {
					seen.add(line);
					result.push(line);
				}
			}
		}
		return result.join("\n");
	}
}

function processEmptyLine(
	lines: string[],
	mode: "all" | "merge"
): string {
	if (mode === "all") {
		// 模式 1：彻底删除所有空行
		return lines.filter((l) => l.trim() !== "").join("\n");
	} else {
		// 模式 2：合并相邻空行
		const result: string[] = [];
		let prevWasEmpty = false;

		for (const line of lines) {
			const isEmpty = line.trim() === "";
			if (!isEmpty) {
				// 非空行，直接加入结果
				result.push(line);
				prevWasEmpty = false;
			} else {
				// 当前是空行，只有在前一行不是空行时才加入（即合并多个为一个）
				if (!prevWasEmpty) {
					result.push("");
					prevWasEmpty = true;
				}
			}
		}
		return result.join("\n");
	}
}

function processRegex(
	text: string,
	findText: string,
	replaceText: string
): string {
	try {
		const regex = new RegExp(findText, "g");
		const result = text.replace(regex, replaceText);
		new Notice(t("NOTICE_REGEX_DONE"));
		return result;
	} catch (e) {
		new Notice(t("NOTICE_REGEX_ERROR"));
		return text;
	}
}

function processAddWrap(
	lines: string[],
	prefix: string,
	suffix: string
): string {
	return lines
		.map((line) => {
			return `${prefix || ""}${line}${suffix || ""}`;
		})
		.join("\n");
}

function processRemoveString(
	lines: string[],
	filterText: string,
	filterMode: "containing" | "not-containing",
	filterCase: boolean,
	filterRegex: boolean
): string {
	if (!filterText) {
		new Notice(t("NOTICE_FILTER_INPUT"));
		return lines.join("\n");
	}

	const result = lines.filter((line) => {
		let isMatch = false;

		if (filterRegex) {
			try {
				const flags = filterCase ? "g" : "gi";
				const regex = new RegExp(filterText, flags);
				isMatch = regex.test(line);
			} catch (e) {
				new Notice(t("NOTICE_REGEX_INVALID"));
				return true; // 保持行不变
			}
		} else {
			const target = filterCase ? line : line.toLowerCase();
			const search = filterCase ? filterText : filterText.toLowerCase();
			isMatch = target.includes(search);
		}

		// 根据"包含"或"不包含"决定是否移除该行
		return filterMode === "containing" ? !isMatch : isMatch;
	});

	new Notice(t("NOTICE_FILTER_DONE"));
	return result.join("\n");
}

function processExtractColumn(
	lines: string[],
	columnDelimiter: string,
	customDelimiter: string,
	columnNumber: number
): string {
	// 确定最终使用的分隔符
	const actualDelim =
		columnDelimiter === "custom" ? customDelimiter : columnDelimiter;

	if (!actualDelim && columnDelimiter === "custom") {
		new Notice(t("NOTICE_CUSTOM_DELIM"));
		return lines.join("\n");
	}

	const colIndex = columnNumber - 1; // 转为数组索引
	const result = lines
		.map((line) => {
			const parts = line.split(actualDelim);
			// 如果该行有这一列，返回内容；否则返回空字符串
			return parts.length > colIndex ? parts[colIndex]?.trim() : "";
		})
		.filter((val) => val !== "") // 可选：过滤掉无法提取的行（空结果）
		.join("\n");

	new Notice(t("NOTICE_EXTRACT_COL_DONE", [columnNumber.toString()]));
	return result;
}

function processSwapColumns(
	lines: string[],
	columnDelimiterSC: string,
	customDelimiterSC: string,
	swapCol1: number,
	swapCol2: number
): string {
	const delim =
		columnDelimiterSC === "custom" ? customDelimiterSC : columnDelimiterSC;

	if (!delim) {
		new Notice(t("NOTICE_DELIM_REQUIRED"));
		return lines.join("\n");
	}

	const idx1 = swapCol1 - 1;
	const idx2 = swapCol2 - 1;

	const result = lines.map((line) => {
		const parts = line.split(delim);
		// 只有当这一行拥有足够的列时才执行交换
		if (parts.length > Math.max(idx1, idx2)) {
			[parts[idx1], parts[idx2]] = [parts[idx2] || "", parts[idx1] || ""];
		}
		return parts.join(delim);
	});

	new Notice(
		t("NOTICE_SWAP_DONE", [swapCol1.toString(), swapCol2.toString()])
	);
	return result.join("\n");
}

function processWordFrequency(
	text: string,
	minWordLength: number,
	includeNumbers: boolean,
	sortOrder: "asc" | "desc"
): string {
	// 1. 预处理：将非字符（根据设置决定是否包含数字）替换为空格，并转为小写
	const regex = includeNumbers
		? /[^a-zA-Z0-9\u4e00-\u9fa5]+/g
		: /[^a-zA-Z\u4e00-\u9fa5]+/g;
	const words = text
		.replace(regex, " ")
		.split(/\s+/)
		.filter((word) => word.length >= minWordLength);

	// 2. 统计频率
	const freqMap: { [key: string]: number } = {};
	words.forEach((word) => {
		if (word) {
			const w = word.toLowerCase();
			freqMap[w] = (freqMap[w] || 0) + 1;
		}
	});

	// 3. 排序并格式化
	const sortedWords = Object.entries(freqMap).sort((a, b) => {
		return sortOrder === "desc" ? b[1] - a[1] : a[1] - b[1];
	});

	// 4. 输出格式：词 (次数)
	const result = sortedWords
		.map(([word, count]) => `${word} (${count})`)
		.join("\n");

	new Notice(t("NOTICE_FREQ_DONE", [sortedWords.length.toString()]));
	return result;
}

function processNumberList(
	lines: string[],
	startNumber: number,
	stepNumber: number,
	listSeparator: string,
	listPrefix: string
): string {
	let currentNum = startNumber;

	return lines
		.map((line) => {
			const numberedLine = `${listPrefix}${currentNum}${listSeparator}${line}`;
			currentNum += stepNumber;
			return numberedLine;
		})
		.join("\n");
}

function processExtractBetween(
	text: string,
	extractStart: string,
	extractEnd: string,
	extractRegex: boolean
): string {
	if (!extractStart && !extractEnd) {
		new Notice(t("NOTICE_EXTRACT_BOUNDS"));
		return text;
	}

	// 辅助函数：转义正则特殊字符
	const escapeRegExp = (str: string) =>
		str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	let pattern: RegExp;
	try {
		if (extractRegex) {
			// 如果用户选了正则，直接构造
			pattern = new RegExp(`${extractStart}(.*?)${extractEnd}`, "g");
		} else {
			// 如果是普通字符，先转义再构造，确保 (.*?) 是非贪婪匹配
			const s = escapeRegExp(extractStart);
			const e = escapeRegExp(extractEnd);
			pattern = new RegExp(`${s}(.*?)${e}`, "g");
		}

		const matches: string[] = [];
		let match;
		// 在全文中循环查找所有匹配项
		while ((match = pattern.exec(text)) !== null) {
			// match[1] 是括号中的捕获组内容
			if (match[1] !== undefined) {
				matches.push(match[1]);
			}
		}

		if (matches.length > 0) {
			const result = matches.join("\n");
			new Notice(
				t("NOTICE_EXTRACT_DONE", [matches.length.toString()])
			);
			return result;
		} else {
			new Notice(t("NOTICE_NO_MATCH"));
			return text;
		}
	} catch (e) {
		new Notice(t("NOTICE_EXTRACT_ERROR"));
		return text;
	}
}

function processRemoveWhitespace(
	text: string,
	wsCompress: boolean,
	wsTrim: boolean,
	wsAll: boolean,
	wsTabs: boolean
): string {
	let result = text;

	// 1. 先处理制表符
	if (wsTabs) {
		result = result.replace(/\t/g, "");
	}

	// 2. 处理所有空格（最高优先级的删除）
	if (wsAll) {
		result = result.replace(/ /g, "");
	} else {
		// 如果不是删除所有空格，则执行压缩和 Trim
		if (wsCompress) {
			// 将 2 个及以上的空格替换为 1 个
			result = result.replace(/ +/g, " ");
		}

		if (wsTrim) {
			// 对每一行执行 trim
			result = result
				.split("\n")
				.map((line) => line.trim())
				.join("\n");
		}
	}

	return result;
}

function processLineBreakTools(
	text: string,
	lbTrigger: string,
	lbAction: "add-after" | "add-before" | "remove-after" | "remove-before",
	lbRegex: boolean
): string {
	if (!lbTrigger) {
		new Notice(t("NOTICE_LB_TRIGGER"));
		return text;
	}

	try {
		// 辅助函数：转义普通字符以用于正则
		const escape = (str: string) =>
			str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const patternStr = lbRegex ? lbTrigger : escape(lbTrigger);

		let regex: RegExp;
		let replacement = "";

		switch (lbAction) {
			case "add-after":
				// 在匹配项后加换行：$0 是匹配到的内容本身
				regex = new RegExp(patternStr, "g");
				replacement = `$&` + `\n`;
				break;
			case "add-before":
				// 在匹配项前加换行
				regex = new RegExp(patternStr, "g");
				replacement = `\n` + `$&`;
				break;
			case "remove-after":
				// 移除匹配项后的换行：匹配 内容+换行 替换为 内容
				regex = new RegExp(`${patternStr}\\n`, "g");
				replacement = `$&`.replace(/\n$/, ""); // 移除匹配末尾的换行
				break;
			case "remove-before":
				// 移除匹配项前的换行
				regex = new RegExp(`\\n${patternStr}`, "g");
				replacement = `$&`.replace(/^\n/, ""); // 移除匹配开头的换行
				break;
		}

		// 执行替换
		if (lbAction.startsWith("add")) {
			return text.replace(regex!, replacement);
		} else {
			// 移除操作时，由于正则已经包含了 \n，直接替换为匹配项中除换行外的部分
			return text.replace(regex!, (match) => {
				return lbAction === "remove-after"
					? match.replace(/\n$/, "")
					: match.replace(/^\n/, "");
			});
		}
	} catch (e) {
		new Notice(t("NOTICE_LB_ERROR"));
		return text;
	}
}

function processClearFormat(
	text: string,
	clearBold: boolean,
	clearItalic: boolean,
	clearHighlight: boolean,
	clearStrikethrough: boolean,
	clearCode: boolean,
	clearLinks: boolean
): string {
	let result = text;

	// 1. 清理加粗 (**text** 或 __text__)
	if (clearBold) {
		result = result.replace(/(\*\*|__)(.*?)\1/g, "$2");
	}

	// 2. 清理斜体 (*text* 或 _text_)
	// 注意：正则需要避免误删加粗遗留的标记
	if (clearItalic) {
		result = result.replace(/([^\*]|^)\*([^\*]+)\*([^\*]|$)/g, "$1$2$3");
		result = result.replace(/([^_]|^)_([^_]+)_([^_]|$)/g, "$1$2$3");
	}

	// 3. 清理高亮 (==text==)
	if (clearHighlight) {
		result = result.replace(/==(.*?)==/g, "$1");
	}

	// 4. 清理删除线 (~~text~~)
	if (clearStrikethrough) {
		result = result.replace(/~~(.*?)~~/g, "$1");
	}

	// 5. 清理行内代码 (`code`)
	if (clearCode) {
		result = result.replace(/`(.*?)`/g, "$1");
	}

	// 6. 清理链接 [文字](链接) -> 仅保留文字
	if (clearLinks) {
		result = result.replace(/\[(.*?)\]\(.*?\)/g, "$1");
	}

	return result;
}

