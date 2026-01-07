import { setIcon } from "obsidian";
import { t } from "../../lang/helpers";

export interface ToolGroup {
	name: string;
	tools: Tool[];
}

export interface Tool {
	id: string;
	name: string;
	icon: string;
}

export interface CustomActionBrief {
	id: string;
	name: string;
	icon?: string;
	showInRibbon?: boolean;
}

export interface CustomScriptBrief {
	id: string;
	name: string;
	icon?: string;
	showInRibbon: boolean;
}

/**
 * 获取工具组配置
 */
export function getToolGroups(
	customActions: CustomActionBrief[] = [],
	customScripts: CustomScriptBrief[] = [],
	enabledTools?: Record<string, boolean>
): ToolGroup[] {
	const isEnabled = (id: string) => enabledTools?.[id] ?? true;

	const groups: ToolGroup[] = [
		{
			name: t("GROUP_AI"),
			tools: [
				// 先显示自定义提示词
				...customActions
					.filter((a) => a.showInRibbon)
					.map((a) => ({
						id: `custom-ai:${a.id}`,
						name: a.name || t("CUSTOM_PROMPT_DEFAULT_NAME"),
						icon: a.icon || "sparkles",
					})),
				// 再显示内置 AI 工具
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
		{
			name: t("GROUP_SCRIPTS"),
			tools: [
				...customScripts
					.filter((s) => s.showInRibbon)
					.map((s) => ({
						id: `custom-script:${s.id}`,
						name: s.name,
						icon: s.icon || "scroll",
					})),
			],
		},
		{
			name: t("GROUP_BASIC"),
			tools: [
				{
					id: "on-select",
					name: t("TOOL_ON_SELECT"),
					icon: "mouse-pointer-click",
				},
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
	];

	// Filter tools based on visibility
	return groups
		.map((group) => ({
			...group,
			tools: group.tools.filter((t) => isEnabled(t.id)),
		}))
		.filter((group) => group.tools.length > 0);
}

/**
 * 渲染工具面板
 */
export function renderToolsPanel(
	parent: HTMLElement,
	activeTool: string,
	onToolSelect: (toolId: string) => void,
	customActions: CustomActionBrief[] = [],
	customScripts: CustomScriptBrief[] = [],
	enabledTools?: Record<string, boolean>
): void {
	parent.createEl("h4", {
		text: t("TEXT_TOOLS"),
		cls: "mtt-panel-title",
	});

	const groups = getToolGroups(customActions, customScripts, enabledTools);

	groups.forEach((group) => {
		parent.createEl("h6", {
			text: group.name,
			cls: "mtt-group-label",
		});
		group.tools.forEach((tool) => {
			const btn = parent.createDiv({
				cls: `mtt-tool-item ${
					activeTool === tool.id ? "is-active" : ""
				}`,
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
