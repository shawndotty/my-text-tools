export interface BatchOperation {
	toolId: string;
	settingsSnapshot: SettingsState;
}

export interface BatchProcess {
	id: string;
	name: string;
	operations: BatchOperation[];
}

/**
 * 设置状态类型定义
 */
export interface SettingsState {
	savedBatches: BatchProcess[]; // 保存的批处理
	findText: string;
	replaceText: string;
	prefix: string;
	suffix: string;
	filterText: string; // 过滤关键字
	filterMode: "containing" | "not-containing"; // containing 或 not-containing
	filterCase: boolean; // 是否区分大小写
	filterRegex: boolean; // 是否开启正则匹配
	columnDelimiter: string; // 分隔符，默认是逗号
	columnNumber: number; // 提取第几列
	customDelimiter: string; // 自定义分隔符存储
	swapCol1: number; // 第一列序号
	swapCol2: number; // 第二列序号
	columnDelimiterSC: string; // 复用之前的分隔符设置
	customDelimiterSC: string;
	minWordLength: number; // 忽略过短的词（比如只统计3个字母以上的词）
	includeNumbers: boolean; // 是否包含纯数字
	sortOrder: "asc" | "desc";
	startNumber: number; // 起始数字
	stepNumber: number; // 增量步长
	listSeparator: string; // 数字后的分隔符
	listPrefix: string; // 数字前的字符（可选）
	extractStart: string; // 开始标记
	extractEnd: string; // 结束标记
	extractRegex: boolean; // 是否启用正则
	extractJoin: string; // 提取结果的分隔符
	wsCompress: boolean; // 压缩连续空格为一个
	wsTrim: boolean; // 删除每行首尾空格
	wsAll: boolean; // 删除所有空格
	wsTabs: boolean; // 删除所有制表符
	lbTrigger: string; // 触发内容（字符或正则）
	lbAction:
		| "add-after"
		| "add-before"
		| "remove-after"
		| "remove-before"
		| "remove-all";
	lbRegex: boolean; // 是否启用正则
	lbStyle: "auto" | "LF" | "CRLF";
	lbMergeEmpty: boolean;
	preserveFrontmatter: boolean; // 默认开启保护
	preserveHeader: boolean; // 默认不开启，用户按需勾选
	dedupeIncludeEmpty: boolean; // 默认不包含空行，即：空行不参与去重，原样保留
	emptyLineMode: "all" | "merge"; // "all" 为删除所有空行，"merge" 为合并相邻空行为一个
	clearBold: boolean; // 清理加粗 ** 或 __
	clearItalic: boolean; // 清理斜体 * 或 _
	clearHighlight: boolean; // 清理高亮 ==
	clearStrikethrough: boolean; // 清理删除线 ~~
	clearCode: boolean; // 清理行内代码 `
	clearLinks: boolean; // 清理链接 [text](url) -> text

	// On-select tool settings
	onSelectEnabled: boolean;
	onSelectAction:
		| "wrap"
		| "regex"
		| "replace-all"
		| "delete"
		| "html-entity"
		| "lowercase"
		| "uppercase";
	onSelectFind: string;
	onSelectReplace: string;
	onSelectPrefix: string;
	onSelectSuffix: string;
	onSelectCaseInsensitive: boolean;
	onSelectRegex: boolean;

	// Combination Generator settings
	combinationInputs: string[];
	customIcons: Record<string, string>;
}

/**
 * 默认设置状态
 */
export const DEFAULT_SETTINGS_STATE: SettingsState = {
	savedBatches: [],
	findText: "",
	replaceText: "",
	prefix: "",
	suffix: "",
	filterText: "",
	filterMode: "containing",
	filterCase: false,
	filterRegex: false,
	columnDelimiter: ",",
	columnNumber: 1,
	customDelimiter: "",
	swapCol1: 1,
	swapCol2: 2,
	columnDelimiterSC: ",",
	customDelimiterSC: "",
	minWordLength: 1,
	includeNumbers: false,
	sortOrder: "desc",
	startNumber: 1,
	stepNumber: 1,
	listSeparator: ". ",
	listPrefix: "",
	extractStart: "",
	extractEnd: "",
	extractRegex: false,
	extractJoin: "\n",
	wsCompress: true,
	wsTrim: true,
	wsAll: false,
	wsTabs: false,
	lbTrigger: "",
	lbAction: "add-after",
	lbRegex: false,
	lbStyle: "auto",
	lbMergeEmpty: false,
	preserveFrontmatter: true,
	preserveHeader: false,
	dedupeIncludeEmpty: false,
	emptyLineMode: "all",
	clearBold: true,
	clearItalic: true,
	clearHighlight: true,
	clearStrikethrough: true,
	clearCode: false,
	clearLinks: false,

	// On-select defaults
	onSelectEnabled: false,
	onSelectAction: "wrap",
	onSelectFind: "",
	onSelectReplace: "",
	onSelectPrefix: "",
	onSelectSuffix: "",
	onSelectCaseInsensitive: false,
	onSelectRegex: false,

	// Combination Generator defaults
	combinationInputs: ["", ""],
	customIcons: {},
};

/**
 * 工具类型
 */
export type ToolType =
	| "regex"
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
