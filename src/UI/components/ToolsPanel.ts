import { setIcon } from "obsidian";
import { t } from "../../lang/helpers";
import { ToolType } from "../../types";

export interface ToolGroup {
	name: string;
	tools: Tool[];
}

export interface Tool {
	id: ToolType;
	name: string;
	icon: string;
}

/**
 * 获取工具组配置
 */
export function getToolGroups(): ToolGroup[] {
	return [
		{
			name: t("GROUP_BASIC"),
			tools: [
				{ id: "regex", name: t("TOOL_REGEX"), icon: "search" },
				{
					id: "remove-whitespace",
					name: t("TOOL_WHITESPACE"),
					icon: "brush-cleaning",
				},
				{
					id: "clear-format",
					name: t("TOOL_CLEAR_FORMAT"),
					icon: "eraser",
				},
			],
		},
		{
			name: t("GROUP_LINES"),
			tools: [
				{
					id: "dedupe",
					name: t("TOOL_DEDUPE"),
					icon: "list-minus",
				},
				{
					id: "empty-line",
					name: t("TOOL_EMPTY_LINE"),
					icon: "list-x",
				},
				{
					id: "line-break-tools",
					name: t("TOOL_LINE_BREAK"),
					icon: "wrap-text",
				},
				{
					id: "add-wrap",
					name: t("TOOL_WRAP"),
					icon: "list-collapse",
				},
				{
					id: "remove-string",
					name: t("TOOL_FILTER"),
					icon: "filter",
				},
				{
					id: "number-list",
					name: t("TOOL_NUMBER_LIST"),
					icon: "list-ordered",
				},
			],
		},
		{
			name: t("GROUP_COLUMNS"),
			tools: [
				{
					id: "extract-column",
					name: t("TOOL_EXTRACT_COL"),
					icon: "columns",
				},
				{
					id: "swap-columns",
					name: t("TOOL_SWAP_COL"),
					icon: "arrow-left-right",
				},
			],
		},
		{
			name: t("GROUP_ANALYSIS"),
			tools: [
				{
					id: "extract-between",
					name: t("TOOL_EXTRACT_BETWEEN"),
					icon: "scissors",
				},
				{
					id: "word-frequency",
					name: t("TOOL_WORD_FREQ"),
					icon: "bar-chart",
				},
			],
		},
		{
			name: t("GROUP_AI"),
			tools: [
				{
					id: "ai-extract-keypoints",
					name: t("TOOL_AI_EXTRACT_KEYPOINTS"),
					icon: "sparkles",
				},
				{
					id: "ai-summarize",
					name: t("TOOL_AI_SUMMARIZE"),
					icon: "file-text",
				},
				{
					id: "ai-translate",
					name: t("TOOL_AI_TRANSLATE"),
					icon: "languages",
				},
				{
					id: "ai-polish",
					name: t("TOOL_AI_POLISH"),
					icon: "wand",
				},
			],
		},
	];
}

/**
 * 渲染工具面板
 */
export function renderToolsPanel(
	parent: HTMLElement,
	activeTool: string,
	onToolSelect: (toolId: ToolType) => void
): void {
	parent.createEl("h4", {
		text: t("TEXT_TOOLS"),
		cls: "mtt-panel-title",
	});

	const groups = getToolGroups();

	groups.forEach((group) => {
		parent.createEl("h6", {
			text: group.name,
			cls: "mtt-group-label",
		});
		group.tools.forEach((tool) => {
			const btn = parent.createDiv({
				cls: `mtt-tool-item ${activeTool === tool.id ? "is-active" : ""}`,
			});
			const iconSpan = btn.createSpan({ cls: "mtt-tool-icon" });
			setIcon(iconSpan, tool.icon); // 设置内置图标
			btn.createSpan({ text: tool.name });

			btn.onclick = () => {
				onToolSelect(tool.id);
			};
		});
	});
}

