import { setIcon } from "obsidian";
import { t } from "../../lang/helpers";
import { SettingsState } from "../../types";
import { AIToolConfig } from "../../settings";

export interface SettingsPanelCallbacks {
	onSettingsChange: (key: string, value: any) => void;
	onRun: (toolId: string) => void | Promise<void>;
	onSaveAISettings?: (
		toolId: string,
		config: AIToolConfig
	) => void | Promise<void>;
}

const DEFAULT_AI_KEYS: Record<string, { prompt: string; system: string }> = {
	"ai-extract-keypoints": {
		prompt: "PROMPT_EXTRACT_KEYPOINTS",
		system: "SYSTEM_PROMPT_EXTRACT",
	},
	"ai-summarize": {
		prompt: "PROMPT_SUMMARIZE",
		system: "SYSTEM_PROMPT_SUMMARIZE",
	},
	"ai-translate": {
		prompt: "PROMPT_TRANSLATE",
		system: "SYSTEM_PROMPT_TRANSLATE",
	},
	"ai-polish": {
		prompt: "PROMPT_POLISH",
		system: "SYSTEM_PROMPT_POLISH",
	},
};

/**
 * 渲染全局设置
 */
export function renderGlobalSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("h4", {
		text: t("SETTINGS_GLOBAL_TITLE"),
		cls: "mtt-panel-title",
	});
	const globalSettings = parent.createDiv({
		cls: "mtt-settings-content",
	});

	// Frontmatter 保护开关
	const fmLabel = globalSettings.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const fmCheck = fmLabel.createEl("input", { type: "checkbox" });
	fmCheck.checked = settings.preserveFrontmatter;
	fmCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"preserveFrontmatter",
			(e.target as HTMLInputElement).checked
		);
	fmLabel.appendText(t("CHECKBOX_PRESERVE_FRONTMATTER"));

	// 首行保护
	const headerLabel = globalSettings.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const headerCheck = headerLabel.createEl("input", { type: "checkbox" });
	headerCheck.checked = settings.preserveHeader;
	headerCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"preserveHeader",
			(e.target as HTMLInputElement).checked
		);
	headerLabel.appendText(t("CHECKBOX_PRESERVE_HEADER"));
}

/**
 * 渲染工具特定设置
 */
export function renderToolSettings(
	parent: HTMLElement,
	activeTool: string | "",
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks,
	aiToolsConfig?: Record<string, AIToolConfig>
): void {
	parent.createEl("hr"); // 分隔线

	parent.createEl("h4", {
		text: t("SETTINGS_TITLE"),
		cls: "mtt-panel-title",
	});

	if (!activeTool) {
		parent.createEl("p", {
			text: t("SETTINGS_EMPTY"),
			cls: "mtt-empty-state",
		});
		return;
	}

	const settingsContent = parent.createDiv({
		cls: "mtt-settings-content",
	});

	// 自定义 AI 卡片
	if (activeTool.startsWith("custom-ai:")) {
		settingsContent.createEl("p", {
			text: t("AI_HINT"),
			cls: "mtt-ai-hint",
		});
		const runBtn = settingsContent.createEl("button", {
			text: t("BTN_RUN_AI"),
			cls: "mtt-run-btn",
		});
		runBtn.onclick = () => callbacks.onRun(activeTool);
		return;
	}

	// 自定义脚本卡片
	if (activeTool.startsWith("custom-script:")) {
		settingsContent.createEl("p", {
			text: t("HINT_RUN_SCRIPT"),
			cls: "mtt-ai-hint",
		});
		const runBtn = settingsContent.createEl("button", {
			text: t("BTN_RUN_SCRIPT"),
			cls: "mtt-run-btn",
		});
		runBtn.onclick = () => callbacks.onRun(activeTool);
		return;
	}

	switch (activeTool) {
		case "remove-string":
			renderFilterSettings(settingsContent, settings, callbacks);
			break;
		case "regex":
			renderRegexSettings(settingsContent, settings, callbacks);
			break;
		case "add-wrap":
			renderWrapSettings(settingsContent, settings, callbacks);
			break;
		case "extract-column":
			renderExtractColumnSettings(settingsContent, settings, callbacks);
			break;
		case "swap-columns":
			renderSwapColumnsSettings(settingsContent, settings, callbacks);
			break;
		case "word-frequency":
			renderWordFrequencySettings(settingsContent, settings, callbacks);
			break;
		case "number-list":
			renderNumberListSettings(settingsContent, settings, callbacks);
			break;
		case "extract-between":
			renderExtractBetweenSettings(settingsContent, settings, callbacks);
			break;
		case "remove-whitespace":
			renderWhitespaceSettings(settingsContent, settings, callbacks);
			break;
		case "line-break-tools":
			renderLineBreakSettings(settingsContent, settings, callbacks);
			break;
		case "dedupe":
			renderDedupeSettings(settingsContent, settings, callbacks);
			break;
		case "empty-line":
			renderEmptyLineSettings(settingsContent, settings, callbacks);
			break;
		case "clear-format":
			renderClearFormatSettings(settingsContent, settings, callbacks);
			break;
		case "ai-extract-keypoints":
		case "ai-summarize":
		case "ai-translate":
		case "ai-polish":
			renderAISettings(
				settingsContent,
				activeTool,
				callbacks,
				aiToolsConfig?.[activeTool]
			);
			break;
		case "on-select":
			renderOnSelectSettings(settingsContent, settings, callbacks);
			break;
		case "combination-generator":
			renderCombinationGeneratorSettings(
				settingsContent,
				settings,
				callbacks
			);
			break;
		default:
			settingsContent.createEl("p", {
				text: t("SETTINGS_NO_CONFIG"),
			});
	}
}

// ========== 各个工具的设置渲染函数 ==========

function renderFilterSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", {
		text: t("SETTING_FILTER_TEXT"),
	});
	const filterInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_FILTER"),
		value: settings.filterText,
	});
	filterInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"filterText",
			(e.target as HTMLInputElement).value
		);

	// 包含 / 不包含 切换
	const modeDiv = parent.createDiv({
		cls: "mtt-setting-row",
	});
	modeDiv.createEl("label", { text: t("SETTING_FILTER_MODE") });
	const modeSelect = modeDiv.createEl("select");
	modeSelect.createEl("option", {
		text: t("OPTION_CONTAINING"),
		value: "containing",
	});
	modeSelect.createEl("option", {
		text: t("OPTION_NOT_CONTAINING"),
		value: "not-containing",
	});
	modeSelect.value = settings.filterMode;
	modeSelect.onchange = (e) =>
		callbacks.onSettingsChange(
			"filterMode",
			(e.target as HTMLSelectElement).value
		);

	// 复选框：区分大小写
	const caseLabel = parent.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const caseCheck = caseLabel.createEl("input", { type: "checkbox" });
	caseCheck.checked = settings.filterCase;
	caseCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"filterCase",
			(e.target as HTMLInputElement).checked
		);
	caseLabel.appendText(" " + t("CHECKBOX_CASE"));

	// 复选框：正则表达式
	const regexLabel = parent.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const regexCheck = regexLabel.createEl("input", {
		type: "checkbox",
	});
	regexCheck.checked = settings.filterRegex;
	regexCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"filterRegex",
			(e.target as HTMLInputElement).checked
		);
	regexLabel.appendText(" " + t("CHECKBOX_REGEX"));

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_FILTER"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("remove-string");
}

function renderRegexSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", { text: t("SETTING_FIND") });
	const findInput = parent.createEl("input", {
		type: "text",
		value: settings.findText,
	});
	findInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"findText",
			(e.target as HTMLInputElement).value
		);

	parent.createEl("label", {
		text: t("SETTING_REPLACE"),
	});
	const replaceInput = parent.createEl("input", {
		type: "text",
		value: settings.replaceText,
	});
	replaceInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"replaceText",
			(e.target as HTMLInputElement).value
		);

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_REPLACE"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("regex");
}

function renderWrapSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const wrapContent = parent.createDiv({
		cls: "mtt-settings-content",
	});

	wrapContent.createEl("label", { text: t("SETTING_PREFIX") });
	const preInput = wrapContent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_PREFIX"),
		value: settings.prefix,
	});
	preInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"prefix",
			(e.target as HTMLInputElement).value
		);

	wrapContent.createEl("label", { text: t("SETTING_SUFFIX") });
	const sufInput = wrapContent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_SUFFIX"),
		value: settings.suffix,
	});
	sufInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"suffix",
			(e.target as HTMLInputElement).value
		);

	const runBtn = wrapContent.createEl("button", {
		text: t("BTN_RUN_WRAP"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("add-wrap");
}

function renderExtractColumnSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", {
		text: t("SETTING_DELIMITER"),
	});
	const delimSelect = parent.createEl("select", {
		cls: "mtt-select",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_COMMA"),
		value: ",",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_TAB"),
		value: "\t",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_PIPE"),
		value: "|",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_SPACE"),
		value: " ",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_CUSTOM"),
		value: "custom",
	});

	delimSelect.value = settings.columnDelimiter;

	// 如果是自定义，显示输入框
	const customInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_CUSTOM_DELIMITER"),
		cls: "mtt-small-input",
		value: settings.customDelimiter,
	});
	customInput.style.display =
		settings.columnDelimiter === "custom" ? "block" : "none";

	delimSelect.onchange = (e) => {
		const val = (e.target as HTMLSelectElement).value;
		callbacks.onSettingsChange("columnDelimiter", val);
		customInput.style.display = val === "custom" ? "block" : "none";
	};
	customInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"customDelimiter",
			(e.target as HTMLInputElement).value
		);

	parent.createEl("label", {
		text: t("SETTING_COL_NUM"),
	});
	const numInput = parent.createEl("input", {
		type: "number",
		attr: { min: 1 },
		value: settings.columnNumber.toString(),
	});
	numInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"columnNumber",
			parseInt((e.target as HTMLInputElement).value) || 1
		);

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_EXTRACT_COL"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("extract-column");
}

function renderSwapColumnsSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", {
		text: t("SETTING_DELIMITER"),
	});
	const delimSelect = parent.createEl("select", {
		cls: "mtt-select",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_COMMA"),
		value: ",",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_TAB"),
		value: "\t",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_PIPE"),
		value: "|",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_SPACE"),
		value: " ",
	});
	delimSelect.createEl("option", {
		text: t("DELIMITER_CUSTOM"),
		value: "custom",
	});

	delimSelect.value = settings.columnDelimiterSC;

	// 如果是自定义，显示输入框
	const customInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_CUSTOM_DELIMITER"),
		cls: "mtt-small-input",
		value: settings.customDelimiterSC,
	});
	customInput.style.display =
		settings.columnDelimiterSC === "custom" ? "block" : "none";

	delimSelect.onchange = (e) => {
		const val = (e.target as HTMLSelectElement).value;
		callbacks.onSettingsChange("columnDelimiterSC", val);
		customInput.style.display = val === "custom" ? "block" : "none";
	};
	customInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"customDelimiterSC",
			(e.target as HTMLInputElement).value
		);

	const colInputGroup = parent.createDiv({
		cls: "mtt-setting-row-inline",
	});

	colInputGroup.createSpan({ text: t("LABEL_SWAP_1") });
	const input1 = colInputGroup.createEl("input", {
		type: "number",
		cls: "mtt-number-input",
		value: settings.swapCol1.toString(),
	});
	input1.onchange = (e) =>
		callbacks.onSettingsChange(
			"swapCol1",
			parseInt((e.target as HTMLInputElement).value) || 1
		);

	colInputGroup.createSpan({ text: t("LABEL_SWAP_2") });
	const input2 = colInputGroup.createEl("input", {
		type: "number",
		cls: "mtt-number-input",
		value: settings.swapCol2.toString(),
	});
	input2.onchange = (e) =>
		callbacks.onSettingsChange(
			"swapCol2",
			parseInt((e.target as HTMLInputElement).value) || 1
		);

	colInputGroup.createSpan({ text: t("LABEL_SWAP_3") });

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_SWAP"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("swap-columns");
}

function renderWordFrequencySettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", {
		text: t("SETTING_MIN_LEN"),
	});
	const minLenInput = parent.createEl("input", {
		type: "number",
		value: settings.minWordLength.toString(),
	});
	minLenInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"minWordLength",
			parseInt((e.target as HTMLInputElement).value) || 1
		);

	const numLabel = parent.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const numCheck = numLabel.createEl("input", { type: "checkbox" });
	numCheck.checked = settings.includeNumbers;
	numCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"includeNumbers",
			(e.target as HTMLInputElement).checked
		);
	numLabel.appendText(" " + t("CHECKBOX_INCLUDE_NUM"));

	parent.createEl("label", { text: t("SETTING_SORT") });
	const sortSelect = parent.createEl("select", {
		cls: "mtt-select",
	});
	sortSelect.createEl("option", {
		text: t("OPTION_DESC"),
		value: "desc",
	});
	sortSelect.createEl("option", {
		text: t("OPTION_ASC"),
		value: "asc",
	});
	sortSelect.value = settings.sortOrder;
	sortSelect.onchange = (e) =>
		callbacks.onSettingsChange(
			"sortOrder",
			(e.target as HTMLSelectElement).value
		);

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_FREQ"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("word-frequency");
}

function renderNumberListSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", { text: t("SETTING_START_NUM") });
	const startInput = parent.createEl("input", {
		type: "number",
		value: settings.startNumber.toString(),
	});
	startInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"startNumber",
			parseInt((e.target as HTMLInputElement).value) || 1
		);

	parent.createEl("label", { text: t("SETTING_STEP_NUM") });
	const stepInput = parent.createEl("input", {
		type: "number",
		value: settings.stepNumber.toString(),
	});
	stepInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"stepNumber",
			parseInt((e.target as HTMLInputElement).value) || 1
		);

	parent.createEl("label", {
		text: t("SETTING_LIST_PREFIX"),
	});
	const preInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_LIST_PREFIX"),
		value: settings.listPrefix,
	});
	preInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"listPrefix",
			(e.target as HTMLInputElement).value
		);

	parent.createEl("label", {
		text: t("SETTING_LIST_SUFFIX"),
	});
	const sepInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_LIST_SUFFIX"),
		value: settings.listSeparator,
	});
	sepInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"listSeparator",
			(e.target as HTMLInputElement).value
		);

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_NUMBERING"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("number-list");
}

function renderExtractBetweenSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", {
		text: t("SETTING_EXTRACT_START"),
	});
	const startInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_EXTRACT_START"),
		value: settings.extractStart,
	});
	startInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"extractStart",
			(e.target as HTMLInputElement).value
		);

	parent.createEl("label", {
		text: t("SETTING_EXTRACT_END"),
	});
	const endInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_EXTRACT_END"),
		value: settings.extractEnd,
	});
	endInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"extractEnd",
			(e.target as HTMLInputElement).value
		);

	const regexLabel = parent.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const regexCheck = regexLabel.createEl("input", {
		type: "checkbox",
	});
	regexCheck.checked = settings.extractRegex;
	regexCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"extractRegex",
			(e.target as HTMLInputElement).checked
		);
	regexLabel.appendText(" " + t("CHECKBOX_EXTRACT_REGEX"));

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_EXTRACT_BETWEEN"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("extract-between");
}

function renderWhitespaceSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const wsContent = parent.createDiv({
		cls: "mtt-settings-content",
	});

	const createCheck = (label: string, key: string) => {
		const lbl = wsContent.createEl("label", {
			cls: "mtt-checkbox-label",
		});
		const chk = lbl.createEl("input", { type: "checkbox" });
		chk.checked = (settings as any)[key];
		chk.onchange = (e) =>
			callbacks.onSettingsChange(
				key,
				(e.target as HTMLInputElement).checked
			);
		lbl.appendText(` ${label}`);
	};

	createCheck(t("CHECKBOX_WS_COMPRESS"), "wsCompress");
	createCheck(t("CHECKBOX_WS_TRIM"), "wsTrim");
	createCheck(t("CHECKBOX_WS_ALL"), "wsAll");
	createCheck(t("CHECKBOX_WS_TABS"), "wsTabs");

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_CLEAN"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("remove-whitespace");
}

function renderLineBreakSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	parent.createEl("label", {
		text: t("SETTING_LB_TRIGGER"),
	});
	const triggerInput = parent.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_LB_TRIGGER"),
		value: settings.lbTrigger,
	});
	triggerInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"lbTrigger",
			(e.target as HTMLInputElement).value
		);

	const regexLabel = parent.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const regexCheck = regexLabel.createEl("input", {
		type: "checkbox",
	});
	regexCheck.checked = settings.lbRegex;
	regexCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"lbRegex",
			(e.target as HTMLInputElement).checked
		);
	regexLabel.appendText(" " + t("CHECKBOX_LB_REGEX"));

	parent.createEl("label", {
		text: t("SETTING_LB_ACTION"),
	});
	const actionSelect = parent.createEl("select", {
		cls: "mtt-select",
	});
	actionSelect.createEl("option", {
		text: t("OPTION_ADD_AFTER"),
		value: "add-after",
	});
	actionSelect.createEl("option", {
		text: t("OPTION_ADD_BEFORE"),
		value: "add-before",
	});
	actionSelect.createEl("option", {
		text: t("OPTION_REMOVE_AFTER"),
		value: "remove-after",
	});
	actionSelect.createEl("option", {
		text: t("OPTION_REMOVE_BEFORE"),
		value: "remove-before",
	});

	actionSelect.value = settings.lbAction;
	actionSelect.onchange = (e) =>
		callbacks.onSettingsChange(
			"lbAction",
			(e.target as HTMLSelectElement).value
		);

	const runBtn = parent.createEl("button", {
		text: t("BTN_RUN_LB"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("line-break-tools");
}

function renderDedupeSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const dedupeContent = parent.createDiv({
		cls: "mtt-settings-content",
	});

	const emptyLabel = dedupeContent.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const emptyCheck = emptyLabel.createEl("input", {
		type: "checkbox",
	});
	emptyCheck.checked = settings.dedupeIncludeEmpty;
	emptyCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"dedupeIncludeEmpty",
			(e.target as HTMLInputElement).checked
		);
	emptyLabel.appendText(t("CHECKBOX_DEDUPE_INCLUDE_EMPTY"));

	const runBtn = dedupeContent.createEl("button", {
		text: t("BTN_RUN_DEDUPE"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("dedupe");
}

function renderEmptyLineSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const content = parent.createDiv({
		cls: "mtt-settings-content",
	});

	content.createEl("label", { text: t("SETTING_FILTER_MODE") });
	const modeSelect = content.createEl("select", {
		cls: "mtt-select",
	});
	modeSelect.createEl("option", {
		text: t("OPTION_EMPTY_LINE_ALL"),
		value: "all",
	});
	modeSelect.createEl("option", {
		text: t("OPTION_EMPTY_LINE_MERGE"),
		value: "merge",
	});
	modeSelect.value = settings.emptyLineMode;
	modeSelect.onchange = (e) =>
		callbacks.onSettingsChange(
			"emptyLineMode",
			(e.target as HTMLSelectElement).value
		);

	const runBtn = content.createEl("button", {
		text: t("BTN_RUN_EMPTY_LINE"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("empty-line");
}

function renderClearFormatSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const content = parent.createDiv({
		cls: "mtt-settings-content",
	});

	const createCheck = (label: string, key: string) => {
		const lbl = content.createEl("label", {
			cls: "mtt-checkbox-label",
		});
		const chk = lbl.createEl("input", { type: "checkbox" });
		chk.checked = (settings as any)[key];
		chk.onchange = (e) =>
			callbacks.onSettingsChange(
				key,
				(e.target as HTMLInputElement).checked
			);
		lbl.appendText(` ${label}`);
	};

	createCheck(t("SETTING_CLEAR_FORMAT_BOLD"), "clearBold");
	createCheck(t("SETTING_CLEAR_FORMAT_ITALIC"), "clearItalic");
	createCheck(t("SETTING_CLEAR_FORMAT_HIGHLIGHT"), "clearHighlight");
	createCheck(t("SETTING_CLEAR_FORMAT_STRIKE"), "clearStrikethrough");
	createCheck(t("SETTING_CLEAR_FORMAT_CODE"), "clearCode");
	createCheck(t("SETTING_CLEAR_FORMAT_LINKS"), "clearLinks");

	const runBtn = content.createEl("button", {
		text: t("BTN_RUN_CLEAR_FORMAT"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun("clear-format");
}

function renderCombinationGeneratorSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const container = parent.createDiv();

	// Stats Container
	const statsContainer = container.createDiv();
	statsContainer.style.marginBottom = "10px";
	statsContainer.style.padding = "10px";
	statsContainer.style.background = "var(--background-secondary)";
	statsContainer.style.borderRadius = "4px";

	const countEl = statsContainer.createDiv();
	const sampleEl = statsContainer.createDiv();
	const warningEl = statsContainer.createDiv();
	warningEl.style.color = "var(--text-error)";
	warningEl.style.display = "none";

	const updateStats = () => {
		let count = 1;
		const currentInputs = settings.combinationInputs || ["", ""];
		const pools = currentInputs.map((s) => s.split("\n"));
		if (pools.length === 0) count = 0;
		else pools.forEach((p) => (count *= p.length));

		countEl.setText(`${t("LABEL_COMBINATION_COUNT")} ${count}`);

		if (count > 10000) {
			warningEl.setText(t("NOTICE_COMBINATION_LARGE"));
			warningEl.style.display = "block";
		} else {
			warningEl.style.display = "none";
		}

		const sample = pools.map((p) => p[0]).join("");
		sampleEl.setText(`${t("LABEL_COMBINATION_SAMPLE")} ${sample}`);
	};

	// Input Boxes Container
	const inputsContainer = container.createDiv();

	const renderInputs = () => {
		inputsContainer.empty();
		const currentInputs = settings.combinationInputs || ["", ""];

		currentInputs.forEach((input, index) => {
			const row = inputsContainer.createDiv();
			row.style.display = "flex";
			row.style.marginBottom = "10px";
			row.style.gap = "10px";
			row.style.alignItems = "flex-start";

			const textarea = row.createEl("textarea", {
				text: input,
				placeholder: t("PLACEHOLDER_INPUT_BOX"),
			});
			textarea.style.flex = "1";
			textarea.rows = 3;

			textarea.oninput = (e) => {
				const val = (e.target as HTMLTextAreaElement).value;
				const newInputs = [...(settings.combinationInputs || ["", ""])];
				newInputs[index] = val;
				settings.combinationInputs = newInputs;
				callbacks.onSettingsChange("combinationInputs", newInputs);
				updateStats();
			};

			if (currentInputs.length > 2) {
				const removeBtn = row.createDiv({
					cls: "clickable-icon",
					attr: { "aria-label": t("BTN_REMOVE_INPUT_BOX") },
				});
				setIcon(removeBtn, "trash-2");
				removeBtn.onclick = () => {
					const newInputs = (
						settings.combinationInputs || ["", ""]
					).filter((_, i) => i !== index);
					settings.combinationInputs = newInputs;
					callbacks.onSettingsChange("combinationInputs", newInputs);
					renderInputs();
					updateStats();
				};
			}
		});
	};

	renderInputs();
	updateStats();

	// Add Button
	const btnRow = container.createDiv();
	btnRow.style.marginBottom = "20px";

	const addBtn = btnRow.createEl("button", {
		text: t("BTN_ADD_INPUT_BOX"),
	});
	addBtn.onclick = () => {
		const newInputs = [...(settings.combinationInputs || ["", ""]), ""];
		settings.combinationInputs = newInputs;
		callbacks.onSettingsChange("combinationInputs", newInputs);
		renderInputs();
		updateStats();
	};

	// Generate Button
	const genBtn = container.createEl("button", {
		text: t("BTN_GENERATE_COMBINATIONS"),
		cls: "mod-cta",
	});
	genBtn.style.width = "100%";
	genBtn.onclick = () => callbacks.onRun("combination-generator");
}

function renderAISettings(
	parent: HTMLElement,
	toolId: string,
	callbacks: SettingsPanelCallbacks,
	config?: AIToolConfig
): void {
	const content = parent.createDiv({
		cls: "mtt-settings-content",
	});

	// 显示工具描述
	let descText = "";
	switch (toolId) {
		case "ai-extract-keypoints":
			descText = t("AI_DESCRIPTION_EXTRACT");
			break;
		case "ai-summarize":
			descText = t("AI_DESCRIPTION_SUMMARIZE");
			break;
		case "ai-translate":
			descText = t("AI_DESCRIPTION_TRANSLATE");
			break;
		case "ai-polish":
			descText = t("AI_DESCRIPTION_POLISH");
			break;
	}

	content.createEl("p", {
		text: descText,
		cls: "mtt-ai-desc",
	});

	// 如果没有配置，使用默认值
	const defaultKeys = DEFAULT_AI_KEYS[toolId];
	const defPrompt = defaultKeys ? t(defaultKeys.prompt as any) : "";
	const defSys = defaultKeys ? t(defaultKeys.system as any) : "";

	const currentConfig: AIToolConfig = {
		...config,
		prompt: config?.prompt ?? defPrompt,
		systemPrompt: config?.systemPrompt ?? defSys,
	};

	// 1. 提示词设置
	content.createEl("label", { text: t("SETTING_PROMPT") });
	const promptArea = content.createEl("textarea", {
		cls: "mtt-textarea-small",
		text: currentConfig.prompt,
		attr: { rows: 4 },
	});
	promptArea.onchange = async (e) => {
		const newVal = (e.target as HTMLTextAreaElement).value;
		currentConfig.prompt = newVal;
		if (callbacks.onSaveAISettings) {
			await callbacks.onSaveAISettings(toolId, currentConfig);
		}
	};

	// 2. 系统提示词设置
	content.createEl("label", { text: t("SETTING_SYSTEM_PROMPT") });
	const sysPromptArea = content.createEl("textarea", {
		cls: "mtt-textarea-small",
		text: currentConfig.systemPrompt,
		attr: { rows: 4 },
	});
	sysPromptArea.onchange = async (e) => {
		const newVal = (e.target as HTMLTextAreaElement).value;
		currentConfig.systemPrompt = newVal;
		if (callbacks.onSaveAISettings) {
			await callbacks.onSaveAISettings(toolId, currentConfig);
		}
	};

	// 3. 翻译目标语言 (仅 ai-translate)
	if (toolId === "ai-translate") {
		content.createEl("label", { text: t("SETTING_TARGET_LANG") });
		const langInput = content.createEl("input", {
			type: "text",
			placeholder: "English",
			value: currentConfig.targetLanguage || "English",
		});
		langInput.onchange = async (e) => {
			const newVal = (e.target as HTMLInputElement).value;
			currentConfig.targetLanguage = newVal;
			if (callbacks.onSaveAISettings) {
				await callbacks.onSaveAISettings(toolId, currentConfig);
			}
		};
	}

	content.createEl("hr");

	const runBtn = content.createEl("button", {
		text: t("BTN_RUN_AI"),
		cls: "mtt-run-btn",
	});
	runBtn.onclick = () => callbacks.onRun(toolId);
}

function renderOnSelectSettings(
	parent: HTMLElement,
	settings: SettingsState,
	callbacks: SettingsPanelCallbacks
): void {
	const content = parent.createDiv({
		cls: "mtt-settings-content",
	});

	// Description
	content.createEl("p", {
		text: t("ON_SELECT_DESC"),
		cls: "mtt-setting-desc",
	});

	// Enable Toggle
	const enableLabel = content.createEl("label", {
		cls: "mtt-checkbox-label mtt-highlight-label",
	});
	const enableCheck = enableLabel.createEl("input", { type: "checkbox" });
	enableCheck.checked = settings.onSelectEnabled;
	enableCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectEnabled",
			(e.target as HTMLInputElement).checked
		);
	enableLabel.appendText(" " + t("SETTING_ON_SELECT_ENABLE"));

	// Action Select
	const actionLabel = content.createEl("label", {
		text: t("SETTING_ON_SELECT_ACTION"),
	});
	actionLabel.style.marginTop = "10px";
	actionLabel.style.display = "block";
	const actionSelect = content.createEl("select", {
		cls: "mtt-select",
	});
	const actions = [
		{ value: "wrap", label: t("ACTION_WRAP") },
		{ value: "regex", label: t("ACTION_REGEX") },
		{ value: "replace-all", label: t("ACTION_REPLACE_ALL") },
		{ value: "delete", label: t("ACTION_DELETE") },
		{ value: "html-entity", label: t("ACTION_HTML_ENTITY") },
		{ value: "lowercase", label: t("ACTION_LOWERCASE") },
		{ value: "uppercase", label: t("ACTION_UPPERCASE") },
	];

	actions.forEach((act) => {
		actionSelect.createEl("option", {
			value: act.value,
			text: act.label,
		});
	});
	actionSelect.value = settings.onSelectAction;
	actionSelect.onchange = (e) => {
		callbacks.onSettingsChange(
			"onSelectAction",
			(e.target as HTMLSelectElement).value
		);
		// Force re-render to show/hide relevant inputs?
		// Or just manually toggle visibility here.
		updateVisibility();
	};

	// Dynamic Input Container
	const paramsContainer = content.createDiv({ cls: "mtt-params-container" });

	// --- Inputs for Wrap ---
	const wrapDiv = paramsContainer.createDiv({ cls: "mtt-sub-settings" });
	wrapDiv.createEl("label", { text: t("SETTING_PREFIX") });
	const preInput = wrapDiv.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_PREFIX"),
		value: settings.onSelectPrefix,
	});
	preInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectPrefix",
			(e.target as HTMLInputElement).value
		);

	wrapDiv.createEl("label", { text: t("SETTING_SUFFIX") });
	const sufInput = wrapDiv.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_SUFFIX"),
		value: settings.onSelectSuffix,
	});
	sufInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectSuffix",
			(e.target as HTMLInputElement).value
		);

	// --- Inputs for Regex ---
	const regexDiv = paramsContainer.createDiv({ cls: "mtt-sub-settings" });
	regexDiv.createEl("label", { text: t("SETTING_FIND") });
	const findInput = regexDiv.createEl("input", {
		type: "text",
		value: settings.onSelectFind,
	});
	findInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectFind",
			(e.target as HTMLInputElement).value
		);

	regexDiv.createEl("label", { text: t("SETTING_REPLACE") });
	const replaceInput = regexDiv.createEl("input", {
		type: "text",
		value: settings.onSelectReplace,
	});
	replaceInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectReplace",
			(e.target as HTMLInputElement).value
		);

	const regexOpts = regexDiv.createDiv({ cls: "mtt-setting-row" });
	// Case
	const caseLabel = regexOpts.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const caseCheck = caseLabel.createEl("input", { type: "checkbox" });
	caseCheck.checked = settings.onSelectCaseInsensitive;
	caseCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectCaseInsensitive",
			(e.target as HTMLInputElement).checked
		);
	caseLabel.appendText(" " + t("CHECKBOX_CASE"));
	// Regex
	const regLabel = regexOpts.createEl("label", {
		cls: "mtt-checkbox-label",
	});
	const regCheck = regLabel.createEl("input", { type: "checkbox" });
	regCheck.checked = settings.onSelectRegex;
	regCheck.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectRegex",
			(e.target as HTMLInputElement).checked
		);
	regLabel.appendText(" " + t("CHECKBOX_REGEX"));

	// --- Inputs for Replace All ---
	const replaceAllDiv = paramsContainer.createDiv({
		cls: "mtt-sub-settings",
	});
	replaceAllDiv.createEl("label", { text: t("ACTION_REPLACE_ALL") });
	const replaceAllInput = replaceAllDiv.createEl("input", {
		type: "text",
		placeholder: t("PLACEHOLDER_REPLACE_ALL"),
		value: settings.onSelectReplace, // Reuse replaceText
	});
	replaceAllInput.onchange = (e) =>
		callbacks.onSettingsChange(
			"onSelectReplace",
			(e.target as HTMLInputElement).value
		);

	// Visibility Logic
	const updateVisibility = () => {
		const action = actionSelect.value;
		wrapDiv.style.display = action === "wrap" ? "block" : "none";
		regexDiv.style.display = action === "regex" ? "block" : "none";
		replaceAllDiv.style.display =
			action === "replace-all" ? "block" : "none";
	};

	updateVisibility();
}
