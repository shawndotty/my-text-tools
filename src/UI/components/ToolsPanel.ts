import { setIcon } from "obsidian";
import { t } from "../../lang/helpers";
import { BUILTIN_TOOLS } from "../../types";

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

const collapsedGroups = new Set<string>();

/**
 * 获取工具组配置
 */
export function getToolGroups(
	customActions: CustomActionBrief[] = [],
	customScripts: CustomScriptBrief[] = [],
	enabledTools?: Record<string, boolean>,
	customIcons?: Record<string, string>
): ToolGroup[] {
	const isEnabled = (id: string) => enabledTools?.[id] ?? true;

	const getBuiltin = (id: string) => {
		const tool = BUILTIN_TOOLS.find((t) => t.id === id);
		return {
			id,
			name: tool ? t(tool.nameKey as any) : id,
			icon: tool?.icon || "help-circle",
		};
	};

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
				getBuiltin("ai-extract-keypoints"),
				getBuiltin("ai-summarize"),
				getBuiltin("ai-translate"),
				getBuiltin("ai-polish"),
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
				getBuiltin("on-select"),
				getBuiltin("regex"),
				getBuiltin("remove-whitespace"),
				getBuiltin("clear-format"),
			],
		},
		{
			name: t("GROUP_LINES"),
			tools: [
				getBuiltin("dedupe"),
				getBuiltin("empty-line"),
				getBuiltin("line-break-tools"),
				getBuiltin("add-wrap"),
				getBuiltin("remove-string"),
				getBuiltin("number-list"),
				getBuiltin("combination-generator"),
			],
		},
		{
			name: t("GROUP_COLUMNS"),
			tools: [getBuiltin("extract-column"), getBuiltin("swap-columns")],
		},
		{
			name: t("GROUP_ANALYSIS"),
			tools: [
				getBuiltin("extract-between"),
				getBuiltin("word-frequency"),
			],
		},
	];

	if (customIcons) {
		groups.forEach((group) => {
			group.tools.forEach((tool) => {
				const customIcon = customIcons[tool.id];
				if (customIcon) {
					tool.icon = customIcon;
				}
			});
		});
	}

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
	enabledTools?: Record<string, boolean>,
	customIcons?: Record<string, string>
): void {
	parent.createEl("h4", {
		text: t("TEXT_TOOLS"),
		cls: "mtt-panel-title",
	});

	const groups = getToolGroups(
		customActions,
		customScripts,
		enabledTools,
		customIcons
	);

	groups.forEach((group) => {
		const isCollapsed = collapsedGroups.has(group.name);

		const groupHeader = parent.createDiv({
			cls: "mtt-group-header",
		});
		groupHeader.style.display = "flex";
		groupHeader.style.alignItems = "center";
		groupHeader.style.cursor = "pointer";
		groupHeader.style.userSelect = "none";

		const iconSpan = groupHeader.createSpan({ cls: "mtt-collapse-icon" });
		iconSpan.style.marginRight = "4px";
		iconSpan.style.display = "flex";
		setIcon(iconSpan, isCollapsed ? "chevron-right" : "chevron-down");

		groupHeader.createEl("h6", {
			text: group.name,
			cls: "mtt-group-label",
		});
		// Override h6 margin to make it look part of the header
		const h6 = groupHeader.querySelector("h6");
		if (h6) h6.style.margin = "0";

		const toolList = parent.createDiv({
			cls: "mtt-tool-list",
		});
		if (isCollapsed) {
			toolList.style.display = "none";
		}

		groupHeader.onclick = () => {
			if (collapsedGroups.has(group.name)) {
				collapsedGroups.delete(group.name);
				toolList.style.display = "block";
				setIcon(iconSpan, "chevron-down");
			} else {
				collapsedGroups.add(group.name);
				toolList.style.display = "none";
				setIcon(iconSpan, "chevron-right");
			}
		};

		group.tools.forEach((tool) => {
			const btn = toolList.createDiv({
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
