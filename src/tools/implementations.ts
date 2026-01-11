import { Notice } from "obsidian";
import { t } from "../lang/helpers";
import { SettingsState } from "../types";
import { IToolStrategy, ToolExecutionOptions } from "./types";

// ==================== Basic Tools ====================

export class RegexStrategy implements IToolStrategy {
	id = "regex";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		try {
			let flags = "g";
			if (settings.regex.caseInsensitive) flags += "i";
			if (settings.regex.multiline) flags += "m";
			const regex = new RegExp(settings.regex.findText, flags);
			const result = text.replace(regex, settings.regex.replaceText);
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_REGEX_DONE"));
			}
			return result;
		} catch (e) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_REGEX_ERROR"));
			}
			return text;
		}
	}
}

export class RegexExtractStrategy implements IToolStrategy {
	id = "regex-extract";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		if (!settings.regexExtract.rule) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_REGEX_EXTRACT_ERROR"));
			}
			return text;
		}

		try {
			const flags = settings.regexExtract.caseSensitive ? "g" : "gi";
			const regex = new RegExp(settings.regexExtract.rule, flags);
			const matches = text.match(regex);

			if (!matches || matches.length === 0) {
				if (!options?.hideNotice) {
					new Notice(t("NOTICE_NO_MATCH"));
				}
				return text;
			}

			let sep = "\n";
			if (settings.regexExtract.separator === "hyphen") sep = " - ";
			if (settings.regexExtract.separator === "space") sep = " ";

			if (!options?.hideNotice) {
				new Notice(
					t("NOTICE_REGEX_EXTRACT_DONE", [matches.length.toString()])
				);
			}
			return matches.join(sep);
		} catch (e) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_REGEX_EXTRACT_ERROR"));
			}
			return text;
		}
	}
}

export class RemoveWhitespaceStrategy implements IToolStrategy {
	id = "remove-whitespace";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		let result = text;

		if (settings.whitespace.removeTabs) {
			result = result.replace(/\t/g, "");
		}

		if (settings.whitespace.removeAll) {
			result = result.replace(/ /g, "");
		} else {
			if (settings.whitespace.compress) {
				result = result.replace(/ +/g, " ");
			}
			if (settings.whitespace.trim) {
				result = result
					.split("\n")
					.map((line) => line.trim())
					.join("\n");
			}
		}

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_WS_DONE"));
		}
		return result;
	}
}

// ==================== Line Operations ====================

export class DedupeStrategy implements IToolStrategy {
	id = "dedupe";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		let result = "";
		if (settings.dedupeIncludeEmpty) {
			result = Array.from(new Set(lines)).join("\n");
		} else {
			const seen = new Set();
			const resLines: string[] = [];
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed === "") {
					resLines.push(line);
				} else {
					if (!seen.has(line)) {
						seen.add(line);
						resLines.push(line);
					}
				}
			}
			result = resLines.join("\n");
		}

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_DEDUPE"));
		}
		return result;
	}
}

export class EmptyLineStrategy implements IToolStrategy {
	id = "empty-line";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		let result = "";
		if (settings.emptyLineMode === "all") {
			result = lines.filter((l) => l.trim() !== "").join("\n");
		} else {
			const resLines: string[] = [];
			let prevWasEmpty = false;
			for (const line of lines) {
				const isEmpty = line.trim() === "";
				if (!isEmpty) {
					resLines.push(line);
					prevWasEmpty = false;
				} else {
					if (!prevWasEmpty) {
						resLines.push("");
						prevWasEmpty = true;
					}
				}
			}
			result = resLines.join("\n");
		}

		if (!options?.hideNotice) {
			new Notice(
				settings.emptyLineMode === "all"
					? t("NOTICE_EMPTY_LINE")
					: t("NOTICE_EMPTY_LINE_MERGED")
			);
		}
		return result;
	}
}

export class AddWrapStrategy implements IToolStrategy {
	id = "add-wrap";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		const result = lines
			.map((line) => {
				if (settings.wrap.excludeEmptyLines && line.trim().length === 0) {
					return line;
				}
				return `${settings.wrap.prefix || ""}${line}${settings.wrap.suffix || ""}`;
			})
			.join("\n");

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_WRAP_DONE"));
		}
		return result;
	}
}

export class RemoveStringStrategy implements IToolStrategy {
	id = "remove-string";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		if (!settings.filter.text) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_FILTER_INPUT"));
			}
			return text;
		}

		const result = lines
			.filter((line) => {
				let isMatch = false;
				if (settings.filter.useRegex) {
					try {
						const flags = settings.filter.caseSensitive ? "g" : "gi";
						const regex = new RegExp(settings.filter.text, flags);
						isMatch = regex.test(line);
					} catch (e) {
						if (!options?.hideNotice) {
							new Notice(t("NOTICE_REGEX_INVALID"));
						}
						return true;
					}
				} else {
					const target = settings.filter.caseSensitive
						? line
						: line.toLowerCase();
					const search = settings.filter.caseSensitive
						? settings.filter.text
						: settings.filter.text.toLowerCase();
					isMatch = target.includes(search);
				}
				return settings.filter.mode === "containing"
					? !isMatch
					: isMatch;
			})
			.join("\n");

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_FILTER_DONE"));
		}
		return result;
	}
}

export class NumberListStrategy implements IToolStrategy {
	id = "number-list";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		let currentNum = settings.numberList.startNumber;
		const result = lines
			.map((line) => {
				const numberedLine = `${settings.numberList.prefix}${currentNum}${settings.numberList.separator}${line}`;
				currentNum += settings.numberList.stepNumber;
				return numberedLine;
			})
			.join("\n");

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_NUMBER_DONE"));
		}
		return result;
	}
}

export class LineBreakToolsStrategy implements IToolStrategy {
	id = "line-break-tools";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const detected = /\r\n/.test(text)
			? "\r\n"
			: /\r/.test(text) && !/\n/.test(text)
			? "\r"
			: "\n";
		const eol =
			settings.lineBreak.style === "LF"
				? "\n"
				: settings.lineBreak.style === "CRLF"
				? "\r\n"
				: detected;

		if (settings.lineBreak.action === "remove-all") {
			return text.replace(/\r\n|\n|\r/g, "");
		}

		if (!settings.lineBreak.trigger) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_LB_TRIGGER"));
			}
			return text;
		}

		try {
			const escape = (str: string) =>
				str.replace(/[.*+?^${}()|[\\]/g, "\\$& ");
			const patternStr = settings.lineBreak.useRegex
				? settings.lineBreak.trigger
				: escape(settings.lineBreak.trigger);

			let regex: RegExp;
			let replacement = "";

			switch (settings.lineBreak.action) {
				case "add-after":
					regex = new RegExp(patternStr, "g");
					replacement = `$&` + eol;
					break;
				case "add-before":
					regex = new RegExp(patternStr, "g");
					replacement = eol + `$&`;
					break;
				case "remove-after":
					regex = new RegExp(`${patternStr}(?:\r\n|\n|\r)`, "g");
					replacement = `$&`.replace(/\r\n|\n|\r$/, "");
					break;
				case "remove-before":
					regex = new RegExp(`(?:\r\n|\n|\r)${patternStr}`, "g");
					replacement = `$&`.replace(/^\r\n|\n|\r/, "");
					break;
			}

			let out = "";
			if (settings.lineBreak.action.startsWith("add")) {
				out = text.replace(regex!, replacement);
			} else {
				out = text.replace(regex!, (match) => {
					return settings.lineBreak.action === "remove-after"
						? match.replace(/\r\n|\n|\r$/, "")
						: match.replace(/^\r\n|\n|\r/, "");
				});
			}

			if (settings.lineBreak.mergeEmpty) {
				out = out.replace(/(?:\r\n|\n|\r){2,}/g, eol);
			}
			return out;
		} catch (e) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_LB_ERROR"));
			}
			return text;
		}
	}
}

// ==================== Column Operations ====================

export class ExtractColumnStrategy implements IToolStrategy {
	id = "extract-column";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		const actualDelim =
			settings.column.delimiter === "custom"
				? settings.column.customDelimiter
				: settings.column.delimiter;

		if (!actualDelim && settings.column.delimiter === "custom") {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_CUSTOM_DELIM"));
			}
			return text;
		}

		const colIndex = settings.column.number - 1;
		const result = lines
			.map((line) => {
				const parts = line.split(actualDelim);
				return parts.length > colIndex ? parts[colIndex]?.trim() : "";
			})
			.filter((val) => val !== "")
			.join("\n");

		if (!options?.hideNotice) {
			new Notice(
				t("NOTICE_EXTRACT_COL_DONE", [
					settings.column.number.toString(),
				])
			);
		}
		return result;
	}
}

export class SwapColumnsStrategy implements IToolStrategy {
	id = "swap-columns";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const lines = text.split("\n");
		const delim =
			settings.swap.delimiter === "custom"
				? settings.swap.customDelimiter
				: settings.swap.delimiter;

		if (!delim) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_DELIM_REQUIRED"));
			}
			return text;
		}

		const idx1 = settings.swap.col1 - 1;
		const idx2 = settings.swap.col2 - 1;

		const result = lines
			.map((line) => {
				const parts = line.split(delim);
				if (parts.length > Math.max(idx1, idx2)) {
					[parts[idx1], parts[idx2]] = [
						parts[idx2] || "",
						parts[idx1] || "",
					];
				}
				return parts.join(delim);
			})
			.join("\n");

		if (!options?.hideNotice) {
			new Notice(
				t("NOTICE_SWAP_DONE", [
					settings.swap.col1.toString(),
					settings.swap.col2.toString(),
				])
			);
		}
		return result;
	}
}

// ==================== Extraction & Analysis ====================

export class ExtractBetweenStrategy implements IToolStrategy {
	id = "extract-between";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		if (!settings.extractBetween.start && !settings.extractBetween.end) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_EXTRACT_BOUNDS"));
			}
			return text;
		}

		const escapeRegExp = (str: string) =>
			str.replace(/[.*+?^${}()|[\\]/g, "\\$& ");

		try {
			let pattern: RegExp;
			if (settings.extractBetween.useRegex) {
				pattern = new RegExp(
					`${settings.extractBetween.start}(.*?)${settings.extractBetween.end}`,
					"g"
				);
			} else {
				const s = escapeRegExp(settings.extractBetween.start);
				const e = escapeRegExp(settings.extractBetween.end);
				pattern = new RegExp(`${s}(.*?)${e}`, "g");
			}

			const matches: string[] = [];
			let match;
			while ((match = pattern.exec(text)) !== null) {
				if (match[1] !== undefined) {
					matches.push(match[1]);
				}
			}

			if (matches.length > 0) {
				if (!options?.hideNotice) {
					new Notice(
						t("NOTICE_EXTRACT_DONE", [matches.length.toString()])
					);
				}
				// Default join is newline, but we can respect a setting if added.
				// Types define joinSeparator
				const joinSep = settings.extractBetween.joinSeparator || "\n";
				return matches.join(joinSep);
			} else {
				if (!options?.hideNotice) {
					new Notice(t("NOTICE_NO_MATCH"));
				}
				return text;
			}
		} catch (e) {
			if (!options?.hideNotice) {
				new Notice(t("NOTICE_EXTRACT_ERROR"));
			}
			return text;
		}
	}
}

export class WordFrequencyStrategy implements IToolStrategy {
	id = "word-frequency";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const regex = settings.frequency.includeNumbers
			? /[^a-zA-Z0-9\u4e00-\u9fa5]+/g
			: /[^a-zA-Z\u4e00-\u9fa5]+/g;
		const words = text
			.replace(regex, " ")
			.split(/\s+/) // Use regex to split by one or more whitespace characters
			.filter(
				(word) => word.length >= settings.frequency.minWordLength
			);

		const freqMap: { [key: string]: number } = {};
		words.forEach((word) => {
			if (word) {
				const w = word.toLowerCase();
				freqMap[w] = (freqMap[w] || 0) + 1;
			}
		});

		const sortedWords = Object.entries(freqMap).sort((a, b) => {
			return settings.frequency.sortOrder === "desc"
				? b[1] - a[1]
				: a[1] - b[1];
		});

		const result = sortedWords
			.map(([word, count]) => `${word} (${count})`)
			.join("\n");

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_FREQ_DONE", [sortedWords.length.toString()]));
		}
		return result;
	}
}

// ==================== Other Tools ====================

export class ClearFormatStrategy implements IToolStrategy {
	id = "clear-format";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		let result = text;
		const { bold, italic, highlight, strikethrough, code, links } = settings.clearFormat;

		// Placeholders for URLs
		const urlPlaceholders: string[] = [];
		const URL_PREFIX = "【MTT_URL_";
		const URL_SUFFIX = "】";
		const linkPlaceholders: string[] = [];
		const LINK_PREFIX = "【MTT_LINK_";
		const LINK_SUFFIX = "】";

		if (italic) {
			result = result.replace(/\*\[([^\]]*?)\]\(([^)]+)\)\*/g, (match) => {
				const ph = `${LINK_PREFIX}${linkPlaceholders.length}${LINK_SUFFIX}`;
				linkPlaceholders.push(match);
				return ph;
			});
			result = result.replace(
				/(https?|ftp|ftps|file):\/\/[^\s<>'"{}|\\^`\[\]]+|www\.[^\s<>'"{}|\\^`\[\]]+/gi,
				(match) => {
					const ph = `${URL_PREFIX}${urlPlaceholders.length}${URL_SUFFIX}`;
					urlPlaceholders.push(match);
					return ph;
				}
			);
		}

		if (bold) {
			result = result.replace(/(\*\*|__)(.*?)\1/g, "$2");
		}

		if (italic) {
			result = result.replace(
				/([^*]|^)\*([^*]+)\*([^*]|$)/g,
				"$1$2$3"
			);

			const placeholderPattern = /【MTT[^】]*】/g;
			const ranges: { start: number; end: number }[] = [];
			let match;
			while ((match = placeholderPattern.exec(result)) !== null) {
				ranges.push({
					start: match.index,
					end: match.index + match[0].length,
				});
			}
			const isInPlaceholder = (pos: number) =>
				ranges.some((r) => pos >= r.start && pos < r.end);

			result = result.replace(
				/([^_]|^)_([^_]+)_([^_]|$)/g,
				(match, before, content, after, offset) => {
					if (
						isInPlaceholder(offset) ||
						isInPlaceholder(offset + match.length - 1)
					)
						return match;
					return before + content + after;
				}
			);
		}

		if (highlight) {
			result = result.replace(/==(.*? )==/g, "$1");
		}
		if (strikethrough) {
			result = result.replace(/~~(.*?)~~/g, "$1");
		}
		if (code) {
			result = result.replace(/`(.*?)`/g, "$1");
		}
		if (links) {
			result = result.replace(/.*\[(.*?)\].*/g, "$1");
		}

		if (italic) {
			// Restore links first (reverse order)
			for (let i = linkPlaceholders.length - 1; i >= 0; i--) {
				const ph = `${LINK_PREFIX}${i}${LINK_SUFFIX}`;
				if (result.includes(ph))
					result = result.split(ph).join(linkPlaceholders[i]);
			}
			// Restore URLs
			for (let i = urlPlaceholders.length - 1; i >= 0; i--) {
				const ph = `${URL_PREFIX}${i}${URL_SUFFIX}`;
				if (result.includes(ph))
					result = result.split(ph).join(urlPlaceholders[i]);
			}
		}

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_CLEAR_FORMAT_DONE"));
		}
		return result;
	}
}

export class CombinationGeneratorStrategy implements IToolStrategy {
	id = "combination-generator";
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): string {
		const inputs = settings.combinationInputs;
		if (!inputs || inputs.length === 0) return "";

		const pools = inputs.map((input) => input.split(/\r?\n/));
		let result = pools[0];
		if (!result) return "";

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

		if (!options?.hideNotice) {
			new Notice(t("NOTICE_COMBINATION_DONE"));
		}
		return result.join("\n");
	}
}
