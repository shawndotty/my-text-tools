import { Plugin } from "obsidian";
import { MyTextToolsSettings } from "./settings";

export interface BatchOperation {
	toolId: string;
	settingsSnapshot: SettingsState;
}

export interface BatchProcess {
	id: string;
	name: string;
	operations: BatchOperation[];
}

// --- Modular Settings Interfaces ---

export interface RegexSettings {
	findText: string;
	replaceText: string;
	caseInsensitive: boolean;
	multiline: boolean;
}

export interface RegexExtractSettings {
	rule: string;
	caseSensitive: boolean;
	separator: "newline" | "hyphen" | "space";
}

export interface WrapSettings {
	prefix: string;
	suffix: string;
	excludeEmptyLines: boolean;
}

export interface FilterSettings {
	text: string;
	mode: "containing" | "not-containing";
	caseSensitive: boolean;
	useRegex: boolean;
}

export interface ColumnSettings {
	delimiter: string;
	customDelimiter: string;
	number: number;
}

export interface SwapSettings {
	col1: number;
	col2: number;
	delimiter: string;
	customDelimiter: string;
}

export interface WordFrequencySettings {
	minWordLength: number;
	includeNumbers: boolean;
	sortOrder: "asc" | "desc";
}

export interface NumberListSettings {
	startNumber: number;
	stepNumber: number;
	separator: string;
	prefix: string;
}

export interface ExtractBetweenSettings {
	start: string;
	end: string;
	useRegex: boolean;
	joinSeparator: string;
}

export interface WhitespaceSettings {
	compress: boolean;
	trim: boolean;
	removeAll: boolean;
	removeTabs: boolean;
}

export interface LineBreakSettings {
	trigger: string;
	action:
		| "add-after"
		| "add-before"
		| "remove-after"
		| "remove-before"
		| "remove-all";
	useRegex: boolean;
	style: "auto" | "LF" | "CRLF";
	mergeEmpty: boolean;
}

export interface ClearFormatSettings {
	bold: boolean;
	italic: boolean;
	highlight: boolean;
	strikethrough: boolean;
	code: boolean;
	links: boolean;
}

export interface OnSelectSettings {
	enabled: boolean;
	action:
		| "wrap"
		| "regex"
		| "replace-all"
		| "delete"
		| "html-entity"
		| "lowercase"
		| "uppercase";
	find: string;
	replace: string;
	prefix: string;
	suffix: string;
	caseInsensitive: boolean;
	useRegex: boolean;
}

/**
 * 设置状态类型定义
 */
export interface SettingsState {
	savedBatches: BatchProcess[]; // 保存的批处理

	// Modularized Settings
	regex: RegexSettings;
	regexExtract: RegexExtractSettings;
	wrap: WrapSettings;
	filter: FilterSettings;
	column: ColumnSettings;
	swap: SwapSettings;
	frequency: WordFrequencySettings;
	numberList: NumberListSettings;
	extractBetween: ExtractBetweenSettings;
	whitespace: WhitespaceSettings;
	lineBreak: LineBreakSettings;
	clearFormat: ClearFormatSettings;
	onSelect: OnSelectSettings;

	// Common / Global
	preserveFrontmatter: boolean;
	preserveHeader: boolean;
	dedupeIncludeEmpty: boolean; // 默认不包含空行
	emptyLineMode: "all" | "merge"; // "all" | "merge"

	// Combination Generator settings
	combinationInputs: string[];
	customIcons: Record<string, string>;

	// Custom Tool Overrides
	customAiPrompt?: string;
	customAiSystemPrompt?: string;
}

/**
 * 默认设置状态
 */
export const DEFAULT_SETTINGS_STATE: SettingsState = {
	savedBatches: [],

	regex: {
		findText: "",
		replaceText: "",
		caseInsensitive: false,
		multiline: false,
	},
	regexExtract: {
		rule: "",
		caseSensitive: false,
		separator: "newline",
	},
	wrap: {
		prefix: "",
		suffix: "",
		excludeEmptyLines: false,
	},
	filter: {
		text: "",
		mode: "containing",
		caseSensitive: false,
		useRegex: false,
	},
	column: {
		delimiter: ",",
		customDelimiter: "",
		number: 1,
	},
	swap: {
		col1: 1,
		col2: 2,
		delimiter: ",",
		customDelimiter: "",
	},
	frequency: {
		minWordLength: 1,
		includeNumbers: false,
		sortOrder: "desc",
	},
	numberList: {
		startNumber: 1,
		stepNumber: 1,
		separator: ". ",
		prefix: "",
	},
	extractBetween: {
		start: "",
		end: "",
		useRegex: false,
		joinSeparator: "\n",
	},
	whitespace: {
		compress: true,
		trim: true,
		removeAll: false,
		removeTabs: false,
	},
	lineBreak: {
		trigger: "",
		action: "add-after",
		useRegex: false,
		style: "auto",
		mergeEmpty: false,
	},
	clearFormat: {
		bold: true,
		italic: true,
		highlight: true,
		strikethrough: true,
		code: false,
		links: false,
	},
	onSelect: {
		enabled: false,
		action: "wrap",
		find: "",
		replace: "",
		prefix: "",
		suffix: "",
		caseInsensitive: false,
		useRegex: false,
	},

	// Common
	preserveFrontmatter: true,
	preserveHeader: false,
	dedupeIncludeEmpty: false,
	emptyLineMode: "all",

	// Misc
	combinationInputs: ["", ""],
	customIcons: {},
};

/**
 * Helper to migrate flat settings to nested settings
 */
export function migrateToNestedSettings(flat: any): SettingsState {
	// If it already looks nested (has 'regex' property), return as is (shallow check)
	if (flat.regex && flat.whitespace) {
		return flat as SettingsState;
	}

	const s = { ...DEFAULT_SETTINGS_STATE };
	// Safely copy properties from flat object if they exist
	if (flat.savedBatches) s.savedBatches = flat.savedBatches;

	// Regex
	if (flat.findText !== undefined) s.regex.findText = flat.findText;
	if (flat.replaceText !== undefined) s.regex.replaceText = flat.replaceText;
	if (flat.regexCaseInsensitive !== undefined)
		s.regex.caseInsensitive = flat.regexCaseInsensitive;
	if (flat.regexMultiline !== undefined)
		s.regex.multiline = flat.regexMultiline;

	// Regex Extract
	if (flat.regexExtractRule !== undefined)
		s.regexExtract.rule = flat.regexExtractRule;
	if (flat.regexExtractCase !== undefined)
		s.regexExtract.caseSensitive = flat.regexExtractCase;
	if (flat.regexExtractSeparator !== undefined)
		s.regexExtract.separator = flat.regexExtractSeparator;

	// Wrap
	if (flat.prefix !== undefined) s.wrap.prefix = flat.prefix;
	if (flat.suffix !== undefined) s.wrap.suffix = flat.suffix;
	if (flat.wrapExcludeEmptyLines !== undefined)
		s.wrap.excludeEmptyLines = flat.wrapExcludeEmptyLines;

	// Filter
	if (flat.filterText !== undefined) s.filter.text = flat.filterText;
	if (flat.filterMode !== undefined) s.filter.mode = flat.filterMode;
	if (flat.filterCase !== undefined)
		s.filter.caseSensitive = flat.filterCase;
	if (flat.filterRegex !== undefined) s.filter.useRegex = flat.filterRegex;

	// Column
	if (flat.columnDelimiter !== undefined)
		s.column.delimiter = flat.columnDelimiter;
	if (flat.customDelimiter !== undefined)
		s.column.customDelimiter = flat.customDelimiter;
	if (flat.columnNumber !== undefined) s.column.number = flat.columnNumber;

	// Swap
	if (flat.swapCol1 !== undefined) s.swap.col1 = flat.swapCol1;
	if (flat.swapCol2 !== undefined) s.swap.col2 = flat.swapCol2;
	if (flat.columnDelimiterSC !== undefined)
		s.swap.delimiter = flat.columnDelimiterSC;
	if (flat.customDelimiterSC !== undefined)
		s.swap.customDelimiter = flat.customDelimiterSC;

	// Frequency
	if (flat.minWordLength !== undefined)
		s.frequency.minWordLength = flat.minWordLength;
	if (flat.includeNumbers !== undefined)
		s.frequency.includeNumbers = flat.includeNumbers;
	if (flat.sortOrder !== undefined) s.frequency.sortOrder = flat.sortOrder;

	// Number List
	if (flat.startNumber !== undefined)
		s.numberList.startNumber = flat.startNumber;
	if (flat.stepNumber !== undefined)
		s.numberList.stepNumber = flat.stepNumber;
	if (flat.listSeparator !== undefined)
		s.numberList.separator = flat.listSeparator;
	if (flat.listPrefix !== undefined) s.numberList.prefix = flat.listPrefix;

	// Extract Between
	if (flat.extractStart !== undefined)
		s.extractBetween.start = flat.extractStart;
	if (flat.extractEnd !== undefined) s.extractBetween.end = flat.extractEnd;
	if (flat.extractRegex !== undefined)
		s.extractBetween.useRegex = flat.extractRegex;
	if (flat.extractJoin !== undefined)
		s.extractBetween.joinSeparator = flat.extractJoin;

	// Whitespace
	if (flat.wsCompress !== undefined) s.whitespace.compress = flat.wsCompress;
	if (flat.wsTrim !== undefined) s.whitespace.trim = flat.wsTrim;
	if (flat.wsAll !== undefined) s.whitespace.removeAll = flat.wsAll;
	if (flat.wsTabs !== undefined) s.whitespace.removeTabs = flat.wsTabs;

	// Line Break
	if (flat.lbTrigger !== undefined) s.lineBreak.trigger = flat.lbTrigger;
	if (flat.lbAction !== undefined) s.lineBreak.action = flat.lbAction;
	if (flat.lbRegex !== undefined) s.lineBreak.useRegex = flat.lbRegex;
	if (flat.lbStyle !== undefined) s.lineBreak.style = flat.lbStyle;
	if (flat.lbMergeEmpty !== undefined)
		s.lineBreak.mergeEmpty = flat.lbMergeEmpty;

	// Clear Format
	if (flat.clearBold !== undefined) s.clearFormat.bold = flat.clearBold;
	if (flat.clearItalic !== undefined)
		s.clearFormat.italic = flat.clearItalic;
	if (flat.clearHighlight !== undefined)
		s.clearFormat.highlight = flat.clearHighlight;
	if (flat.clearStrikethrough !== undefined)
		s.clearFormat.strikethrough = flat.clearStrikethrough;
	if (flat.clearCode !== undefined) s.clearFormat.code = flat.clearCode;
	if (flat.clearLinks !== undefined) s.clearFormat.links = flat.clearLinks;

	// On Select
	if (flat.onSelectEnabled !== undefined)
		s.onSelect.enabled = flat.onSelectEnabled;
	if (flat.onSelectAction !== undefined)
		s.onSelect.action = flat.onSelectAction;
	if (flat.onSelectFind !== undefined) s.onSelect.find = flat.onSelectFind;
	if (flat.onSelectReplace !== undefined)
		s.onSelect.replace = flat.onSelectReplace;
	if (flat.onSelectPrefix !== undefined)
		s.onSelect.prefix = flat.onSelectPrefix;
	if (flat.onSelectSuffix !== undefined)
		s.onSelect.suffix = flat.onSelectSuffix;
	if (flat.onSelectCaseInsensitive !== undefined)
		s.onSelect.caseInsensitive = flat.onSelectCaseInsensitive;
	if (flat.onSelectRegex !== undefined)
		s.onSelect.useRegex = flat.onSelectRegex;

	// Global
	if (flat.preserveFrontmatter !== undefined)
		s.preserveFrontmatter = flat.preserveFrontmatter;
	if (flat.preserveHeader !== undefined)
		s.preserveHeader = flat.preserveHeader;
	if (flat.dedupeIncludeEmpty !== undefined)
		s.dedupeIncludeEmpty = flat.dedupeIncludeEmpty;
	if (flat.emptyLineMode !== undefined)
		s.emptyLineMode = flat.emptyLineMode;
	if (flat.combinationInputs !== undefined)
		s.combinationInputs = flat.combinationInputs;
	if (flat.customIcons !== undefined) s.customIcons = flat.customIcons;
	if (flat.customAiPrompt !== undefined)
		s.customAiPrompt = flat.customAiPrompt;
	if (flat.customAiSystemPrompt !== undefined)
		s.customAiSystemPrompt = flat.customAiSystemPrompt;

	return s;
}

/**
 * 工具类型
 */
export type ToolType =
	| "regex"
	| "regex-extract"
	| "remove-whitespace"
	| "dedupe"
	| "extract-column"
	| "swap-columns"
	| "extract-between"
	| "word-frequency"
	| "number-list"
	| "add-wrap"
	| "remove-string"
	| "empty-line"
	| "clear-format"
	| "line-break-tools"
	| "combination-generator"
	| "ai-extract-keypoints"
	| "ai-summarize"
	| "ai-translate"
	| "ai-polish";

export interface ToolInfo {
	id: string;
	nameKey: string;
	icon: string;
}

export const BUILTIN_TOOLS: ToolInfo[] = [
	{
		id: "ai-extract-keypoints",
		nameKey: "TOOL_AI_EXTRACT_KEYPOINTS",
		icon: "sparkles",
	},
	{ id: "ai-summarize", nameKey: "TOOL_AI_SUMMARIZE", icon: "file-text" },
	{ id: "ai-translate", nameKey: "TOOL_AI_TRANSLATE", icon: "languages" },
	{ id: "ai-polish", nameKey: "TOOL_AI_POLISH", icon: "wand" },
	{ id: "on-select", nameKey: "TOOL_ON_SELECT", icon: "mouse-pointer-click" },
	{ id: "regex", nameKey: "TOOL_REGEX", icon: "regex" },
	{ id: "regex-extract", nameKey: "TOOL_REGEX_EXTRACT", icon: "text-search" },
	{ id: "remove-whitespace", nameKey: "TOOL_WHITESPACE", icon: "space" },
	{ id: "clear-format", nameKey: "TOOL_CLEAR_FORMAT", icon: "eraser" },
	{ id: "dedupe", nameKey: "TOOL_DEDUPE", icon: "list-minus" },
	{ id: "empty-line", nameKey: "TOOL_EMPTY_LINE", icon: "list-x" },
	{ id: "line-break-tools", nameKey: "TOOL_LINE_BREAK", icon: "pilcrow" },
	{ id: "add-wrap", nameKey: "TOOL_WRAP", icon: "list-collapse" },
	{ id: "remove-string", nameKey: "TOOL_FILTER", icon: "filter-x" },
	{ id: "number-list", nameKey: "TOOL_NUMBER_LIST", icon: "list-ordered" },
	{ id: "extract-column", nameKey: "TOOL_EXTRACT_COL", icon: "columns" },
	{ id: "swap-columns", nameKey: "TOOL_SWAP_COL", icon: "arrow-left-right" },
	{
		id: "extract-between",
		nameKey: "TOOL_EXTRACT_BETWEEN",
		icon: "brackets",
	},
	{ id: "word-frequency", nameKey: "TOOL_WORD_FREQ", icon: "bar-chart" },
	{
		id: "combination-generator",
		nameKey: "TOOL_COMBINATION",
		icon: "combine",
	},
];

export interface MyTextToolsPlugin extends Plugin {
	settings: MyTextToolsSettings;
	saveSettings(): Promise<void>;
	runBatchShortcut(
		batchId: string,
		scope: "note" | "selection",
		editor?: any
	): Promise<void>;
	runCustomScript(scriptId: string): Promise<void>;
	runCustomAIAction(actionId: string): Promise<void>;
}
