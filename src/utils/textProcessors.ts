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
	settings: SettingsState,
	hideNotice: boolean = false
): string {
	let textToProcess = text;
	let extractedFrontmatter = "";
	let extractedHeader = "";

	// --- 第一层：保护 Frontmatter ---
	const fmResult = extractFrontmatter(
		textToProcess,
		settings.preserveFrontmatter
	);
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
			if (!hideNotice) {
				new Notice(t("NOTICE_DEDUPE"));
			}
			break;
		case "empty-line":
			processedBody = processEmptyLine(lines, settings.emptyLineMode);
			if (!hideNotice) {
				new Notice(
					settings.emptyLineMode === "all"
						? t("NOTICE_EMPTY_LINE")
						: t("NOTICE_EMPTY_LINE_MERGED")
				);
			}
			break;
		case "regex":
			processedBody = processRegex(
				textToProcess,
				settings.findText,
				settings.replaceText,
				settings.regexCaseInsensitive,
				settings.regexMultiline,
				hideNotice
			);
			break;
		case "regex-extract":
			processedBody = processRegexExtract(
				textToProcess,
				settings.regexExtractRule,
				settings.regexExtractCase,
				settings.regexExtractSeparator,
				hideNotice
			);
			break;
		case "add-wrap":
			processedBody = processAddWrap(
				lines,
				settings.prefix,
				settings.suffix,
				settings.wrapExcludeEmptyLines
			);
			if (!hideNotice) {
				new Notice(t("NOTICE_WRAP_DONE"));
			}
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
				settings.columnNumber,
				hideNotice
			);
			break;
		case "swap-columns":
			processedBody = processSwapColumns(
				lines,
				settings.columnDelimiterSC,
				settings.customDelimiterSC,
				settings.swapCol1,
				settings.swapCol2,
				hideNotice
			);
			break;
		case "word-frequency":
			processedBody = processWordFrequency(
				textToProcess,
				settings.minWordLength,
				settings.includeNumbers,
				settings.sortOrder,
				hideNotice
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
			if (!hideNotice) {
				new Notice(t("NOTICE_NUMBER_DONE"));
			}
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
			if (!hideNotice) {
				new Notice(t("NOTICE_WS_DONE"));
			}

			break;
		case "line-break-tools":
			processedBody = processLineBreakTools(
				textToProcess,
				settings.lbTrigger,
				settings.lbAction,
				settings.lbRegex,
				settings.lbStyle,
				settings.lbMergeEmpty,
				hideNotice
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
			if (!hideNotice) {
				new Notice(t("NOTICE_CLEAR_FORMAT_DONE"));
			}
			break;
		case "combination-generator":
			processedBody = processCombinationGenerator(
				settings.combinationInputs
			);
			if (!hideNotice) {
				new Notice(t("NOTICE_COMBINATION_DONE"));
			}
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
		if (!hideNotice) {
			new Notice(noticeMsg);
		}
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

function processEmptyLine(lines: string[], mode: "all" | "merge"): string {
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
	replaceText: string,
	caseInsensitive: boolean,
	multiline: boolean,
	hideNotice: boolean = false
): string {
	try {
		let flags = "g";
		if (caseInsensitive) flags += "i";
		if (multiline) flags += "m";
		const regex = new RegExp(findText, flags);
		const result = text.replace(regex, replaceText);
		if (!hideNotice) {
			new Notice(t("NOTICE_REGEX_DONE"));
		}
		return result;
	} catch (e) {
		if (!hideNotice) {
			new Notice(t("NOTICE_REGEX_ERROR"));
		}
		return text;
	}
}

function processRegexExtract(
	text: string,
	rule: string,
	caseSensitive: boolean,
	separator: "newline" | "hyphen" | "space",
	hideNotice: boolean = false
): string {
	if (!rule) {
		if (!hideNotice) {
			new Notice(t("NOTICE_REGEX_EXTRACT_ERROR"));
		}
		return text;
	}

	try {
		const flags = caseSensitive ? "g" : "gi";
		const regex = new RegExp(rule, flags);
		const matches = text.match(regex);

		if (!matches || matches.length === 0) {
			if (!hideNotice) {
				new Notice(t("NOTICE_NO_MATCH"));
			}
			return text;
		}

		let sep = "\n";
		if (separator === "hyphen") sep = " - ";
		if (separator === "space") sep = " ";

		if (!hideNotice) {
			new Notice(
				t("NOTICE_REGEX_EXTRACT_DONE", [matches.length.toString()])
			);
		}
		return matches.join(sep);
	} catch (e) {
		if (!hideNotice) {
			new Notice(t("NOTICE_REGEX_EXTRACT_ERROR"));
		}
		return text;
	}
}

function processAddWrap(
	lines: string[],
	prefix: string,
	suffix: string,
	excludeEmpty: boolean
): string {
	return lines
		.map((line) => {
			if (excludeEmpty && line.trim().length === 0) {
				return line;
			}
			return `${prefix || ""}${line}${suffix || ""}`;
		})
		.join("\n");
}

function processRemoveString(
	lines: string[],
	filterText: string,
	filterMode: "containing" | "not-containing",
	filterCase: boolean,
	filterRegex: boolean,
	hideNotice: boolean = false
): string {
	if (!filterText) {
		if (!hideNotice) {
			new Notice(t("NOTICE_FILTER_INPUT"));
		}
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
				if (!hideNotice) {
					new Notice(t("NOTICE_REGEX_INVALID"));
				}
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
	if (!hideNotice) {
		new Notice(t("NOTICE_FILTER_DONE"));
	}
	return result.join("\n");
}

function processExtractColumn(
	lines: string[],
	columnDelimiter: string,
	customDelimiter: string,
	columnNumber: number,
	hideNotice: boolean = false
): string {
	// 确定最终使用的分隔符
	const actualDelim =
		columnDelimiter === "custom" ? customDelimiter : columnDelimiter;

	if (!actualDelim && columnDelimiter === "custom") {
		if (!hideNotice) {
			new Notice(t("NOTICE_CUSTOM_DELIM"));
		}
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

	if (!hideNotice) {
		new Notice(t("NOTICE_EXTRACT_COL_DONE", [columnNumber.toString()]));
	}
	return result;
}

function processSwapColumns(
	lines: string[],
	columnDelimiterSC: string,
	customDelimiterSC: string,
	swapCol1: number,
	swapCol2: number,
	hideNotice: boolean = false
): string {
	const delim =
		columnDelimiterSC === "custom" ? customDelimiterSC : columnDelimiterSC;

	if (!delim) {
		if (!hideNotice) {
			new Notice(t("NOTICE_DELIM_REQUIRED"));
		}
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

	if (!hideNotice) {
		new Notice(
			t("NOTICE_SWAP_DONE", [swapCol1.toString(), swapCol2.toString()])
		);
	}
	return result.join("\n");
}

function processWordFrequency(
	text: string,
	minWordLength: number,
	includeNumbers: boolean,
	sortOrder: "asc" | "desc",
	hideNotice: boolean = false
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

	if (!hideNotice) {
		new Notice(t("NOTICE_FREQ_DONE", [sortedWords.length.toString()]));
	}
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
	extractRegex: boolean,
	hideNotice: boolean = false
): string {
	if (!extractStart && !extractEnd) {
		if (!hideNotice) {
			new Notice(t("NOTICE_EXTRACT_BOUNDS"));
		}
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
			if (!hideNotice) {
				new Notice(
					t("NOTICE_EXTRACT_DONE", [matches.length.toString()])
				);
			}
			return result;
		} else {
			if (!hideNotice) {
				new Notice(t("NOTICE_NO_MATCH"));
			}
			return text;
		}
	} catch (e) {
		if (!hideNotice) {
			new Notice(t("NOTICE_EXTRACT_ERROR"));
		}
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
	lbAction:
		| "add-after"
		| "add-before"
		| "remove-after"
		| "remove-before"
		| "remove-all",
	lbRegex: boolean,
	lbStyle: "auto" | "LF" | "CRLF",
	lbMergeEmpty: boolean,
	hideNotice: boolean = false
): string {
	const detected = /\r\n/.test(text)
		? "\r\n"
		: /\r/.test(text) && !/\n/.test(text)
		? "\r"
		: "\n";
	const eol =
		lbStyle === "LF" ? "\n" : lbStyle === "CRLF" ? "\r\n" : detected;
	if (lbAction === "remove-all") {
		return text.replace(/\r\n|\n|\r/g, "");
	}
	if (!lbTrigger) {
		if (!hideNotice) {
			new Notice(t("NOTICE_LB_TRIGGER"));
		}
		return text;
	}

	try {
		const escape = (str: string) =>
			str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const patternStr = lbRegex ? lbTrigger : escape(lbTrigger);

		let regex: RegExp;
		let replacement = "";

		switch (lbAction) {
			case "add-after":
				regex = new RegExp(patternStr, "g");
				replacement = `$&` + eol;
				break;
			case "add-before":
				regex = new RegExp(patternStr, "g");
				replacement = eol + `$&`;
				break;
			case "remove-after":
				regex = new RegExp(`${patternStr}(?:\\r\\n|\\n|\\r)`, "g");
				replacement = `$&`.replace(/\r\n|\n|\r$/, "");
				break;
			case "remove-before":
				regex = new RegExp(`(?:\\r\\n|\\n|\\r)${patternStr}`, "g");
				replacement = `$&`.replace(/^\r\n|\n|\r/, "");
				break;
		}

		if (lbAction.startsWith("add")) {
			const out = text.replace(regex!, replacement);
			return lbMergeEmpty ? out.replace(/(?:\r\n|\n|\r){2,}/g, eol) : out;
		} else {
			const out = text.replace(regex!, (match) => {
				return lbAction === "remove-after"
					? match.replace(/\r\n|\n|\r$/, "")
					: match.replace(/^\r\n|\n|\r/, "");
			});
			return lbMergeEmpty ? out.replace(/(?:\r\n|\n|\r){2,}/g, eol) : out;
		}
	} catch (e) {
		if (!hideNotice) {
			new Notice(t("NOTICE_LB_ERROR"));
		}
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

	// 保护 URL 的辅助函数：使用临时标记替换 URL，处理完后再恢复
	// 使用独特的占位符格式，避免与文本内容冲突
	// 使用方括号和特殊字符组合，确保不会被误匹配
	const urlPlaceholders: string[] = [];
	const URL_PLACEHOLDER_PREFIX = "【MTT_URL_";
	const URL_PLACEHOLDER_SUFFIX = "】";

	// 保护 Markdown 链接中的 URL: [text](url)
	const linkPlaceholders: string[] = [];
	const LINK_PLACEHOLDER_PREFIX = "【MTT_LINK_";
	const LINK_PLACEHOLDER_SUFFIX = "】";

	// 保护普通 URL（http://, https://, ftp:// 等）
	// 只在清理斜体时需要保护 URL，因为只有斜体清理会误处理 URL 中的下划线
	if (clearItalic) {
		// 先保护 Markdown 链接中的 URL（避免处理链接中的 URL）
		result = result.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match) => {
			const placeholder = `${LINK_PLACEHOLDER_PREFIX}${linkPlaceholders.length}${LINK_PLACEHOLDER_SUFFIX}`;
			linkPlaceholders.push(match);
			return placeholder;
		});

		// 再保护独立的 URL（不在链接中的）
		// 匹配 http://, https://, ftp://, ftps://, file:// 等协议开头的 URL
		// 也匹配 www. 开头的 URL
		result = result.replace(
			/(https?|ftp|ftps|file):\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+/gi,
			(match) => {
				const placeholder = `${URL_PLACEHOLDER_PREFIX}${urlPlaceholders.length}${URL_PLACEHOLDER_SUFFIX}`;
				urlPlaceholders.push(match);
				return placeholder;
			}
		);
	}

	// 1. 清理加粗 (**text** 或 __text__)
	if (clearBold) {
		result = result.replace(/(\*\*|__)(.*?)\1/g, "$2");
	}

	// 2. 清理斜体 (*text* 或 _text_)
	// 注意：正则需要避免误删加粗遗留的标记和 URL 中的下划线
	if (clearItalic) {
		// 清理星号斜体 *text*
		result = result.replace(/([^\*]|^)\*([^\*]+)\*([^\*]|$)/g, "$1$2$3");

		// 清理下划线斜体 _text_
		// 需要排除占位符中的下划线（占位符格式：【MTT_URL_0】或【MTT_LINK_0】）
		// 使用更简单可靠的方法：先找到所有占位符的位置，然后只处理不在占位符内的下划线
		const placeholderRanges: Array<{ start: number; end: number }> = [];

		// 找到所有占位符的位置
		const placeholderPattern = /【MTT[^】]*】/g;
		let match;
		while ((match = placeholderPattern.exec(result)) !== null) {
			placeholderRanges.push({
				start: match.index,
				end: match.index + match[0].length,
			});
		}

		// 检查位置是否在占位符内
		const isInPlaceholder = (pos: number): boolean => {
			return placeholderRanges.some(
				(range) => pos >= range.start && pos < range.end
			);
		};

		// 清理下划线斜体，但跳过占位符内的
		result = result.replace(
			/([^_]|^)_([^_]+)_([^_]|$)/g,
			(match, before, content, after, offset) => {
				// 检查匹配的开始位置是否在占位符内
				if (isInPlaceholder(offset)) {
					return match;
				}
				// 检查匹配的结束位置是否在占位符内
				if (isInPlaceholder(offset + match.length - 1)) {
					return match;
				}
				// 检查匹配的中间部分是否在占位符内
				for (let i = offset; i < offset + match.length; i++) {
					if (isInPlaceholder(i)) {
						return match;
					}
				}
				// 否则正常清理斜体
				return before + content + after;
			}
		);
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

	// 恢复 URL 占位符（必须在所有格式清理完成后恢复）
	// 先恢复链接（按索引倒序恢复，避免索引冲突）
	if (clearItalic && linkPlaceholders.length > 0) {
		for (let i = linkPlaceholders.length - 1; i >= 0; i--) {
			const placeholder = `${LINK_PLACEHOLDER_PREFIX}${i}${LINK_PLACEHOLDER_SUFFIX}`;
			const originalLink = linkPlaceholders[i];
			if (originalLink && result.includes(placeholder)) {
				// 使用全局替换，确保所有匹配的占位符都被替换
				result = result.split(placeholder).join(originalLink);
			}
		}
	}

	// 再恢复独立的 URL（按索引倒序恢复）
	if (clearItalic && urlPlaceholders.length > 0) {
		for (let i = urlPlaceholders.length - 1; i >= 0; i--) {
			const placeholder = `${URL_PLACEHOLDER_PREFIX}${i}${URL_PLACEHOLDER_SUFFIX}`;
			const originalUrl = urlPlaceholders[i];
			if (originalUrl) {
				// 首先尝试精确匹配标准格式 【MTT_URL_0】
				if (result.includes(placeholder)) {
					result = result.split(placeholder).join(originalUrl);
				} else {
					// 如果标准格式不存在，尝试匹配可能的变体格式
					// 匹配格式：【MTTURL0】或【MTT-URL-0】等（下划线可能被删除）
					const variantPatterns = [
						new RegExp(`【MTT[_-]?URL[_-]?${i}】`, "g"),
						new RegExp(`【MTTURL${i}】`, "g"),
						new RegExp(`【MTT_URL${i}】`, "g"),
					];

					for (const pattern of variantPatterns) {
						if (pattern.test(result)) {
							result = result.replace(pattern, originalUrl);
							break; // 找到一个匹配就停止
						}
					}
				}
			}
		}
	}

	return result;
}

export function processCombinationGenerator(inputs: string[]): string {
	if (!inputs || inputs.length === 0) return "";

	// Convert inputs to arrays of lines, handling Windows line endings
	const pools = inputs.map((input) => input.split(/\r?\n/));

	let result = pools[0];
	if (!result) return "";

	// Iterative Cartesian product
	for (let i = 1; i < pools.length; i++) {
		const nextPool = pools[i];
		if (!nextPool) continue;

		const nextResult: string[] = [];
		for (const r of result) {
			for (const n of nextPool) {
				nextResult.push(r + n);
			}
		}
		result = nextResult;
	}

	return result.join("\n");
}
