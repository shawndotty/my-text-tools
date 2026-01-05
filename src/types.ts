/**
 * 设置状态类型定义
 */
export interface SettingsState {
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
	lbAction: "add-after" | "add-before" | "remove-after" | "remove-before"; // 执行的操作
	lbRegex: boolean; // 是否启用正则
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
}

/**
 * 默认设置状态
 */
export const DEFAULT_SETTINGS_STATE: SettingsState = {
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
};

/**
 * 工具类型
 */
export type ToolType =
	| "regex"
	| "remove-whitespace"
	| "clear-format"
	| "dedupe"
	| "empty-line"
	| "line-break-tools"
	| "add-wrap"
	| "remove-string"
	| "number-list"
	| "extract-column"
	| "swap-columns"
	| "extract-between"
	| "word-frequency"
	| "ai-extract-keypoints"
	| "ai-summarize"
	| "ai-translate"
	| "ai-polish";

