import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	setIcon,
	TFile,
	normalizePath,
} from "obsidian";
import { t } from "../lang/helpers";

export const MY_TEXT_TOOLS_VIEW = "my-text-tools-view";

export class MyTextToolsView extends ItemView {
	content: string = ""; // 存储中间窗口的临时文本内容
	history: string[] = []; // 用于存储历史记录的栈
	redoHistory: string[] = []; // 重做栈 (Redo Stack)
	maxHistorySize: number = 20; // 限制撤销步数，防止内存占用过高
	originalEditor: any = null; // 对原笔记编辑器的引用
	activeTool: string = ""; // 当前选中的工具 ID

	// 设置项的状态存储
	settingsState: { [key: string]: any } = {
		findText: "",
		replaceText: "",
		prefix: "",
		suffix: "",
		filterText: "", // 过滤关键字
		filterMode: "containing", // containing 或 not-containing
		filterCase: false, // 是否区分大小写
		filterRegex: false, // 是否开启正则匹配
		columnDelimiter: ",", // 分隔符，默认是逗号
		columnNumber: 1, // 提取第几列
		customDelimiter: "", // 自定义分隔符存储
		swapCol1: 1, // 第一列序号
		swapCol2: 2, // 第二列序号
		columnDelimiterSC: ",", // 复用之前的分隔符设置
		customDelimiterSC: "",
		minWordLength: 1, // 忽略过短的词（比如只统计3个字母以上的词）
		includeNumbers: false, // 是否包含纯数字
		sortOrder: "desc",
		startNumber: 1, // 起始数字
		stepNumber: 1, // 增量步长
		listSeparator: ". ", // 数字后的分隔符
		listPrefix: "", // 数字前的字符（可选）
		extractStart: "", // 开始标记
		extractEnd: "", // 结束标记
		extractRegex: false, // 是否启用正则
		extractJoin: "\n", // 提取结果的分隔符
		wsCompress: true, // 压缩连续空格为一个
		wsTrim: true, // 删除每行首尾空格
		wsAll: false, // 删除所有空格
		wsTabs: false, // 删除所有制表符
		lbTrigger: "", // 触发内容（字符或正则）
		lbAction: "add-after", // 执行的操作
		lbRegex: false, // 是否启用正则
		preserveFrontmatter: true, // 默认开启保护
		preserveHeader: false, // 默认不开启，用户按需勾选
		dedupeIncludeEmpty: false, // 默认不包含空行，即：空行不参与去重，原样保留
		emptyLineMode: "all", // "all" 为删除所有空行，"merge" 为合并相邻空行为一个
	};

	constructor(leaf: WorkspaceLeaf, originalEditor: any) {
		super(leaf);
		this.originalEditor = originalEditor;
		if (originalEditor) {
			this.content = originalEditor.getValue();
		}
	}

	getViewType() {
		return MY_TEXT_TOOLS_VIEW;
	}
	getDisplayText() {
		return t("WORKBENCH_TITLE");
	}
	getIcon() {
		return "remove-formatting";
	} // 使用内置图标

	async onOpen() {
		this.render();
		// 在 onOpen 生命周期中加入
		// 撤销 Ctrl+Z
		this.scope?.register(["Mod"], "z", (evt) => {
			this.undo();
			return false;
		});

		// 重做 Ctrl+Y
		this.scope?.register(["Mod"], "y", (evt) => {
			this.redo();
			return false;
		});

		// 重做 Ctrl+Shift+Z (符合部分用户习惯)
		this.scope?.register(["Mod", "Shift"], "z", (evt) => {
			this.redo();
			return false;
		});
	}

	render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("mtt-layout-container");

		// --- 1. 左侧：工具导航栏 ---
		const leftPanel = container.createDiv({ cls: "mtt-left-panel" });
		this.renderTools(leftPanel);

		// --- 2. 中间：主编辑区域 ---
		const centerPanel = container.createDiv({ cls: "mtt-center-panel" });
		this.renderMainEditor(centerPanel);

		// --- 3. 右侧：动态设置区域 ---
		const rightPanel = container.createDiv({ cls: "mtt-right-panel" });
		this.renderSettings(rightPanel);
	}

	// 左侧工具列表
	renderTools(parent: HTMLElement) {
		parent.createEl("h4", {
			text: t("TEXT_TOOLS"),
			cls: "mtt-panel-title",
		});

		const groups = [
			{
				name: t("GROUP_BASIC"),
				tools: [
					{ id: "regex", name: t("TOOL_REGEX"), icon: "search" },
					{
						id: "remove-whitespace",
						name: t("TOOL_WHITESPACE"),
						icon: "brush-cleaning",
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

		groups.forEach((group) => {
			parent.createEl("h6", {
				text: group.name,
				cls: "mtt-group-label",
			});
			group.tools.forEach((tool) => {
				const btn = parent.createDiv({
					cls: `mtt-tool-item ${
						this.activeTool === tool.id ? "is-active" : ""
					}`,
				});
				const iconSpan = btn.createSpan({ cls: "mtt-tool-icon" });
				setIcon(iconSpan, tool.icon); // 设置内置图标
				btn.createSpan({ text: tool.name });

				btn.onclick = () => {
					this.activeTool = tool.id;
					// 如果是简单功能直接执行，如果是复杂功能则先切换设置面板

					this.render(); // 重新渲染以更新 UI 状态
				};
			});
		});
	}

	// 中间编辑器
	renderMainEditor(parent: HTMLElement) {
		const header = parent.createDiv({ cls: "mtt-center-header" });
		header.createEl("span", { text: t("EDITOR_HEADER") });

		// 按钮容器
		const actionGroup = header.createDiv({ cls: "mtt-action-group" });

		// 撤销按钮
		const undoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_UNDO") },
		});
		setIcon(undoBtn, "undo-2");
		undoBtn.toggleClass("is-disabled", this.history.length === 0);
		undoBtn.onclick = () => this.undo();

		// 重做按钮
		const redoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_REDO") },
		});
		setIcon(redoBtn, "redo-2");
		redoBtn.toggleClass("is-disabled", this.redoHistory.length === 0);
		redoBtn.onclick = () => this.redo();

		// 如果没有历史记录，让按钮看起来是禁用的
		if (this.history.length === 0) {
			undoBtn.addClass("is-disabled");
		}

		const textArea = parent.createEl("textarea", {
			cls: "mtt-textarea",
			attr: { placeholder: t("EDITOR_PLACEHOLDER") },
		});
		textArea.value = this.content;

		textArea.oninput = (e) => {
			this.content = (e.target as HTMLTextAreaElement).value;
		};

		const footer = parent.createDiv({ cls: "mtt-center-footer" });

		// 按钮组容器，方便设置间距
		const btnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });

		// 1. 复制到剪贴板按钮
		const copyClipboardBtn = btnGroup.createEl("button", {
			text: t("BTN_COPY_CLIPBOARD"),
			cls: "mtt-secondary-btn", // 可以复用次要按钮样式
		});
		// 增加一个小图标增强视觉
		// setIcon(copyClipboardBtn.createSpan(), "copy");

		copyClipboardBtn.onclick = async () => {
			try {
				await navigator.clipboard.writeText(this.content);
				new Notice(t("NOTICE_COPY_CLIPBOARD_SUCCESS"));
			} catch (err) {
				new Notice(t("NOTICE_COPY_CLIPBOARD_ERROR"));
			}
		};

		// 按钮 1：存为新笔记
		const saveNewBtn = btnGroup.createEl("button", {
			text: t("BTN_SAVE_NEW"),
			cls: "mtt-secondary-btn",
		});
		saveNewBtn.onclick = () => this.saveToNewFile();

		// 按钮 2：覆盖原笔记
		if (this.originalEditor) {
			const saveOverBtn = btnGroup.createEl("button", {
				text: t("BTN_SAVE_ORIGINAL"),
				cls: "mod-cta",
			});
			saveOverBtn.onclick = () => this.saveToOriginal();
		}
	}

	// 右侧设置面板 (核心逻辑)
	renderSettings(parent: HTMLElement) {
		parent.createEl("h3", {
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
		fmCheck.checked = this.settingsState.preserveFrontmatter;
		fmCheck.onchange = (e) =>
			(this.settingsState.preserveFrontmatter = (
				e.target as HTMLInputElement
			).checked);
		fmLabel.appendText(t("CHECKBOX_PRESERVE_FRONTMATTER"));

		// 首行保护
		const headerLabel = globalSettings.createEl("label", {
			cls: "mtt-checkbox-label",
		});
		const headerCheck = headerLabel.createEl("input", { type: "checkbox" });
		headerCheck.checked = this.settingsState.preserveHeader;
		headerCheck.onchange = (e) =>
			(this.settingsState.preserveHeader = (
				e.target as HTMLInputElement
			).checked);
		headerLabel.appendText(t("CHECKBOX_PRESERVE_HEADER"));

		parent.createEl("hr"); // 分隔线

		parent.createEl("h3", {
			text: t("SETTINGS_TITLE"),
			cls: "mtt-panel-title",
		});

		if (!this.activeTool) {
			parent.createEl("p", {
				text: t("SETTINGS_EMPTY"),
				cls: "mtt-empty-state",
			});
			return;
		}

		const settingsContent = parent.createDiv({
			cls: "mtt-settings-content",
		});

		if (this.activeTool === "remove-string") {
			settingsContent.createEl("label", {
				text: t("SETTING_FILTER_TEXT"),
			});
			const filterInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_FILTER"),
				value: this.settingsState.filterText,
			});
			filterInput.onchange = (e) =>
				(this.settingsState.filterText = (
					e.target as HTMLInputElement
				).value);

			// 包含 / 不包含 切换
			const modeDiv = settingsContent.createDiv({
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
			modeSelect.value = this.settingsState.filterMode;
			modeSelect.onchange = (e) =>
				(this.settingsState.filterMode = (
					e.target as HTMLSelectElement
				).value);

			// 复选框：区分大小写
			const caseLabel = settingsContent.createEl("label", {
				cls: "mtt-checkbox-label",
			});
			const caseCheck = caseLabel.createEl("input", { type: "checkbox" });
			caseCheck.checked = this.settingsState.filterCase;
			caseCheck.onchange = (e) =>
				(this.settingsState.filterCase = (
					e.target as HTMLInputElement
				).checked);
			caseLabel.appendText(" " + t("CHECKBOX_CASE"));

			// 复选框：正则表达式
			const regexLabel = settingsContent.createEl("label", {
				cls: "mtt-checkbox-label",
			});
			const regexCheck = regexLabel.createEl("input", {
				type: "checkbox",
			});
			regexCheck.checked = this.settingsState.filterRegex;
			regexCheck.onchange = (e) =>
				(this.settingsState.filterRegex = (
					e.target as HTMLInputElement
				).checked);
			regexLabel.appendText(" " + t("CHECKBOX_REGEX"));

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_FILTER"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("remove-string");
		} else if (this.activeTool === "regex") {
			settingsContent.createEl("label", { text: t("SETTING_FIND") });
			const findInput = settingsContent.createEl("input", {
				type: "text",
				value: this.settingsState.findText,
			});
			findInput.onchange = (e) =>
				(this.settingsState.findText = (
					e.target as HTMLInputElement
				).value);

			settingsContent.createEl("label", {
				text: t("SETTING_REPLACE"),
			});
			const replaceInput = settingsContent.createEl("input", {
				type: "text",
				value: this.settingsState.replaceText,
			});
			replaceInput.onchange = (e) =>
				(this.settingsState.replaceText = (
					e.target as HTMLInputElement
				).value);

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_REPLACE"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("regex");
		} else if (this.activeTool === "add-wrap") {
			const wrapContent = settingsContent.createDiv({
				cls: "mtt-settings-content",
			});

			wrapContent.createEl("label", { text: t("SETTING_PREFIX") });
			const preInput = wrapContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_PREFIX"),
				value: this.settingsState.prefix,
			});
			preInput.onchange = (e) =>
				(this.settingsState.prefix = (
					e.target as HTMLInputElement
				).value);

			wrapContent.createEl("label", { text: t("SETTING_SUFFIX") });
			const sufInput = wrapContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_SUFFIX"),
				value: this.settingsState.suffix,
			});
			sufInput.onchange = (e) =>
				(this.settingsState.suffix = (
					e.target as HTMLInputElement
				).value);

			const runBtn = wrapContent.createEl("button", {
				text: t("BTN_RUN_WRAP"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("add-wrap");
		} else if (this.activeTool === "extract-column") {
			settingsContent.createEl("label", {
				text: t("SETTING_DELIMITER"),
			});
			const delimSelect = settingsContent.createEl("select", {
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

			delimSelect.value = this.settingsState.columnDelimiter;

			// 如果是自定义，显示输入框
			const customInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_CUSTOM_DELIMITER"),
				cls: "mtt-small-input",
				value: this.settingsState.customDelimiter,
			});
			customInput.style.display =
				this.settingsState.columnDelimiter === "custom"
					? "block"
					: "none";

			delimSelect.onchange = (e) => {
				const val = (e.target as HTMLSelectElement).value;
				this.settingsState.columnDelimiter = val;
				customInput.style.display = val === "custom" ? "block" : "none";
			};
			customInput.onchange = (e) =>
				(this.settingsState.customDelimiter = (
					e.target as HTMLInputElement
				).value);

			settingsContent.createEl("label", {
				text: t("SETTING_COL_NUM"),
			});
			const numInput = settingsContent.createEl("input", {
				type: "number",
				attr: { min: 1 },
				value: this.settingsState.columnNumber.toString(),
			});
			numInput.onchange = (e) =>
				(this.settingsState.columnNumber =
					parseInt((e.target as HTMLInputElement).value) || 1);

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_EXTRACT_COL"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("extract-column");
		} else if (this.activeTool === "swap-columns") {
			settingsContent.createEl("label", {
				text: t("SETTING_DELIMITER"),
			});
			const delimSelect = settingsContent.createEl("select", {
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

			delimSelect.value = this.settingsState.columnDelimiterSC;

			// 如果是自定义，显示输入框
			const customInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_CUSTOM_DELIMITER"),
				cls: "mtt-small-input",
				value: this.settingsState.customDelimiterSC,
			});
			customInput.style.display =
				this.settingsState.columnDelimiterSC === "custom"
					? "block"
					: "none";

			delimSelect.onchange = (e) => {
				const val = (e.target as HTMLSelectElement).value;
				this.settingsState.columnDelimiterSC = val;
				customInput.style.display = val === "custom" ? "block" : "none";
			};
			customInput.onchange = (e) =>
				(this.settingsState.customDelimiterSC = (
					e.target as HTMLInputElement
				).value);

			const colInputGroup = settingsContent.createDiv({
				cls: "mtt-setting-row-inline",
			});

			colInputGroup.createSpan({ text: t("LABEL_SWAP_1") });
			const input1 = colInputGroup.createEl("input", {
				type: "number",
				cls: "mtt-number-input",
				value: this.settingsState.swapCol1.toString(),
			});
			input1.onchange = (e) =>
				(this.settingsState.swapCol1 =
					parseInt((e.target as HTMLInputElement).value) || 1);

			colInputGroup.createSpan({ text: t("LABEL_SWAP_2") });
			const input2 = colInputGroup.createEl("input", {
				type: "number",
				cls: "mtt-number-input",
				value: this.settingsState.swapCol2.toString(),
			});
			input2.onchange = (e) =>
				(this.settingsState.swapCol2 =
					parseInt((e.target as HTMLInputElement).value) || 1);

			colInputGroup.createSpan({ text: t("LABEL_SWAP_3") });

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_SWAP"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("swap-columns");
		} else if (this.activeTool === "word-frequency") {
			settingsContent.createEl("label", {
				text: t("SETTING_MIN_LEN"),
			});
			const minLenInput = settingsContent.createEl("input", {
				type: "number",
				value: this.settingsState.minWordLength.toString(),
			});
			minLenInput.onchange = (e) =>
				(this.settingsState.minWordLength =
					parseInt((e.target as HTMLInputElement).value) || 1);

			const numLabel = settingsContent.createEl("label", {
				cls: "mtt-checkbox-label",
			});
			const numCheck = numLabel.createEl("input", { type: "checkbox" });
			numCheck.checked = this.settingsState.includeNumbers;
			numCheck.onchange = (e) =>
				(this.settingsState.includeNumbers = (
					e.target as HTMLInputElement
				).checked);
			numLabel.appendText(" " + t("CHECKBOX_INCLUDE_NUM"));

			settingsContent.createEl("label", { text: t("SETTING_SORT") });
			const sortSelect = settingsContent.createEl("select", {
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
			sortSelect.value = this.settingsState.sortOrder;
			sortSelect.onchange = (e) =>
				(this.settingsState.sortOrder = (
					e.target as HTMLSelectElement
				).value);

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_FREQ"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("word-frequency");
		} else if (this.activeTool === "number-list") {
			settingsContent.createEl("label", { text: t("SETTING_START_NUM") });
			const startInput = settingsContent.createEl("input", {
				type: "number",
				value: this.settingsState.startNumber.toString(),
			});
			startInput.onchange = (e) =>
				(this.settingsState.startNumber =
					parseInt((e.target as HTMLInputElement).value) || 1);

			settingsContent.createEl("label", { text: t("SETTING_STEP_NUM") });
			const stepInput = settingsContent.createEl("input", {
				type: "number",
				value: this.settingsState.stepNumber.toString(),
			});
			stepInput.onchange = (e) =>
				(this.settingsState.stepNumber =
					parseInt((e.target as HTMLInputElement).value) || 1);

			settingsContent.createEl("label", {
				text: t("SETTING_LIST_PREFIX"),
			});
			const preInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_LIST_PREFIX"),
				value: this.settingsState.listPrefix,
			});
			preInput.onchange = (e) =>
				(this.settingsState.listPrefix = (
					e.target as HTMLInputElement
				).value);

			settingsContent.createEl("label", {
				text: t("SETTING_LIST_SUFFIX"),
			});
			const sepInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_LIST_SUFFIX"),
				value: this.settingsState.listSeparator,
			});
			sepInput.onchange = (e) =>
				(this.settingsState.listSeparator = (
					e.target as HTMLInputElement
				).value);

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_NUMBERING"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("number-list");
		} else if (this.activeTool === "extract-between") {
			settingsContent.createEl("label", {
				text: t("SETTING_EXTRACT_START"),
			});
			const startInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_EXTRACT_START"),
				value: this.settingsState.extractStart,
			});
			startInput.onchange = (e) =>
				(this.settingsState.extractStart = (
					e.target as HTMLInputElement
				).value);

			settingsContent.createEl("label", {
				text: t("SETTING_EXTRACT_END"),
			});
			const endInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_EXTRACT_END"),
				value: this.settingsState.extractEnd,
			});
			endInput.onchange = (e) =>
				(this.settingsState.extractEnd = (
					e.target as HTMLInputElement
				).value);

			const regexLabel = settingsContent.createEl("label", {
				cls: "mtt-checkbox-label",
			});
			const regexCheck = regexLabel.createEl("input", {
				type: "checkbox",
			});
			regexCheck.checked = this.settingsState.extractRegex;
			regexCheck.onchange = (e) =>
				(this.settingsState.extractRegex = (
					e.target as HTMLInputElement
				).checked);
			regexLabel.appendText(" " + t("CHECKBOX_EXTRACT_REGEX"));

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_EXTRACT_BETWEEN"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("extract-between");
		} else if (this.activeTool === "remove-whitespace") {
			const wsContent = settingsContent.createDiv({
				cls: "mtt-settings-content",
			});

			const createCheck = (label: string, key: string) => {
				const lbl = wsContent.createEl("label", {
					cls: "mtt-checkbox-label",
				});
				const chk = lbl.createEl("input", { type: "checkbox" });
				chk.checked = this.settingsState[key];
				chk.onchange = (e) =>
					(this.settingsState[key] = (
						e.target as HTMLInputElement
					).checked);
				lbl.appendText(` ${label}`);
			};

			createCheck(t("CHECKBOX_WS_COMPRESS"), "wsCompress");
			createCheck(t("CHECKBOX_WS_TRIM"), "wsTrim");
			createCheck(t("CHECKBOX_WS_ALL"), "wsAll");
			createCheck(t("CHECKBOX_WS_TABS"), "wsTabs");

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_CLEAN"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("remove-whitespace");
		} else if (this.activeTool === "line-break-tools") {
			settingsContent.createEl("label", {
				text: t("SETTING_LB_TRIGGER"),
			});
			const triggerInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: t("PLACEHOLDER_LB_TRIGGER"),
				value: this.settingsState.lbTrigger,
			});
			triggerInput.onchange = (e) =>
				(this.settingsState.lbTrigger = (
					e.target as HTMLInputElement
				).value);

			const regexLabel = settingsContent.createEl("label", {
				cls: "mtt-checkbox-label",
			});
			const regexCheck = regexLabel.createEl("input", {
				type: "checkbox",
			});
			regexCheck.checked = this.settingsState.lbRegex;
			regexCheck.onchange = (e) =>
				(this.settingsState.lbRegex = (
					e.target as HTMLInputElement
				).checked);
			regexLabel.appendText(" " + t("CHECKBOX_LB_REGEX"));

			settingsContent.createEl("label", {
				text: t("SETTING_LB_ACTION"),
			});
			const actionSelect = settingsContent.createEl("select", {
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

			actionSelect.value = this.settingsState.lbAction;
			actionSelect.onchange = (e) =>
				(this.settingsState.lbAction = (
					e.target as HTMLSelectElement
				).value);

			const runBtn = settingsContent.createEl("button", {
				text: t("BTN_RUN_LB"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("line-break-tools");
		} else if (this.activeTool === "dedupe") {
			const dedupeContent = settingsContent.createDiv({
				cls: "mtt-settings-content",
			});

			const emptyLabel = dedupeContent.createEl("label", {
				cls: "mtt-checkbox-label",
			});
			const emptyCheck = emptyLabel.createEl("input", {
				type: "checkbox",
			});
			emptyCheck.checked = this.settingsState.dedupeIncludeEmpty;
			emptyCheck.onchange = (e) =>
				(this.settingsState.dedupeIncludeEmpty = (
					e.target as HTMLInputElement
				).checked);
			emptyLabel.appendText(t("CHECKBOX_DEDUPE_INCLUDE_EMPTY"));

			const runBtn = dedupeContent.createEl("button", {
				text: t("BTN_RUN_DEDUPE"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("dedupe");
		} else if (this.activeTool === "empty-line") {
			const elContent = settingsContent.createDiv({
				cls: "mtt-settings-content",
			});

			elContent.createEl("label", { text: t("SETTING_EMPTY_LINE_MODE") });
			const modeSelect = elContent.createEl("select", {
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

			modeSelect.value = this.settingsState.emptyLineMode;
			modeSelect.onchange = (e) =>
				(this.settingsState.emptyLineMode = (
					e.target as HTMLSelectElement
				).value);

			const runBtn = elContent.createEl("button", {
				text: t("BTN_RUN_EMPTY_LINE"),
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("empty-line");
		} else {
			settingsContent.createEl("p", {
				text: t("SETTINGS_NO_CONFIG"),
			});
		}
	}

	// 统一处理文本逻辑
	processText(type: string) {
		this.pushToHistory();

		let textToProcess = this.content;
		let extractedFrontmatter = "";
		let extractedHeader = "";

		// --- 第一层：保护 Frontmatter ---
		if (this.settingsState.preserveFrontmatter) {
			const fmMatch = textToProcess.match(
				/^---\n([\s\S]*?)\n---(?:\n|$)/
			);
			if (fmMatch) {
				extractedFrontmatter = fmMatch[0];
				textToProcess = textToProcess.substring(
					extractedFrontmatter.length
				);
			}
		}

		// --- 第二层：保护首行 ---
		let lines = textToProcess.split("\n");
		if (this.settingsState.preserveHeader && lines.length > 0) {
			extractedHeader = lines[0] + "\n"; // 提取第一行并保留换行符
			lines = lines.slice(1); // 剩下的参与处理
		}

		// --- 执行具体的工具逻辑 ---
		let processedBody = "";

		switch (type) {
			case "dedupe":
				const { dedupeIncludeEmpty } = this.settingsState;
				if (dedupeIncludeEmpty) {
					// 经典模式：所有行参与去重（包括空行也会被合并为剩一行）
					processedBody = Array.from(new Set(lines)).join("\n");
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
					processedBody = result.join("\n");
				}
				new Notice(t("NOTICE_DEDUPE"));
				break;
			case "empty-line":
				const { emptyLineMode } = this.settingsState;

				if (emptyLineMode === "all") {
					// 模式 1：彻底删除所有空行
					this.content = lines
						.filter((l) => l.trim() !== "")
						.join("\n");
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
					processedBody = result.join("\n");
				}
				new Notice(
					emptyLineMode === "all"
						? t("NOTICE_EMPTY_LINE")
						: t("NOTICE_EMPTY_LINE_MERGED")
				);
				break;
			case "regex":
				try {
					const regex = new RegExp(this.settingsState.findText, "g");
					processedBody = textToProcess.replace(
						regex,
						this.settingsState.replaceText
					);
					new Notice(t("NOTICE_REGEX_DONE"));
				} catch (e) {
					new Notice(t("NOTICE_REGEX_ERROR"));
				}
				break;
			case "add-wrap":
				const { prefix, suffix } = this.settingsState;

				processedBody = lines
					.map((line) => {
						// 只有当行不为空时才处理，或者根据需要处理所有行
						return `${prefix || ""}${line}${suffix || ""}`;
					})
					.join("\n");

				new Notice(t("NOTICE_WRAP_DONE"));
				break;
			case "remove-string":
				const { filterText, filterMode, filterCase, filterRegex } =
					this.settingsState;

				if (!filterText) {
					new Notice(t("NOTICE_FILTER_INPUT"));
					return;
				}

				processedBody = lines
					.filter((line) => {
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
							const target = filterCase
								? line
								: line.toLowerCase();
							const search = filterCase
								? filterText
								: filterText.toLowerCase();
							isMatch = target.includes(search);
						}

						// 根据“包含”或“不包含”决定是否移除该行
						// 如果是 'containing' 模式且匹配了，就返回 false (移除)
						return filterMode === "containing" ? !isMatch : isMatch;
					})
					.join("\n");

				new Notice(t("NOTICE_FILTER_DONE"));
				break;
			case "extract-column":
				const { columnDelimiter, customDelimiter, columnNumber } =
					this.settingsState;
				// 确定最终使用的分隔符
				const actualDelim =
					columnDelimiter === "custom"
						? customDelimiter
						: columnDelimiter;

				if (!actualDelim && columnDelimiter === "custom") {
					new Notice(t("NOTICE_CUSTOM_DELIM"));
					return;
				}

				const colIndex = columnNumber - 1; // 转为数组索引
				processedBody = lines
					.map((line) => {
						const parts = line.split(actualDelim);
						// 如果该行有这一列，返回内容；否则返回空字符串
						return parts.length > colIndex
							? parts[colIndex]?.trim()
							: "";
					})
					.filter((val) => val !== "") // 可选：过滤掉无法提取的行（空结果）
					.join("\n");

				new Notice(
					t("NOTICE_EXTRACT_COL_DONE", [columnNumber.toString()])
				);
				break;
			case "swap-columns":
				const {
					columnDelimiterSC,
					customDelimiterSC,
					swapCol1,
					swapCol2,
				} = this.settingsState;
				const delim =
					columnDelimiterSC === "custom"
						? customDelimiterSC
						: columnDelimiterSC;

				if (!delim) {
					new Notice(t("NOTICE_DELIM_REQUIRED"));
					return;
				}

				const idx1 = swapCol1 - 1;
				const idx2 = swapCol2 - 1;

				processedBody = lines
					.map((line) => {
						const parts = line.split(delim);
						// 只有当这一行拥有足够的列时才执行交换
						if (parts.length > Math.max(idx1, idx2)) {
							[parts[idx1], parts[idx2]] = [
								parts[idx2] || "",
								parts[idx1] || "",
							];
						}
						return parts.join(delim);
					})
					.join("\n");

				new Notice(
					t("NOTICE_SWAP_DONE", [
						swapCol1.toString(),
						swapCol2.toString(),
					])
				);
				break;
			case "word-frequency":
				const { minWordLength, includeNumbers, sortOrder } =
					this.settingsState;

				// 1. 预处理：将非字符（根据设置决定是否包含数字）替换为空格，并转为小写
				const regex = includeNumbers
					? /[^a-zA-Z0-9\u4e00-\u9fa5]+/g
					: /[^a-zA-Z\u4e00-\u9fa5]+/g;
				const words = textToProcess
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
				processedBody = sortedWords
					.map(([word, count]) => `${word} (${count})`)
					.join("\n");

				new Notice(
					t("NOTICE_FREQ_DONE", [sortedWords.length.toString()])
				);
				break;
			case "number-list":
				const { startNumber, stepNumber, listSeparator, listPrefix } =
					this.settingsState;
				let currentNum = startNumber;

				processedBody = lines
					.map((line, index) => {
						// 如果该行完全为空，我们可以选择跳过不编号，也可以编号。原版通常是全部编号。
						const numberedLine = `${listPrefix}${currentNum}${listSeparator}${line}`;
						currentNum += stepNumber;
						return numberedLine;
					})
					.join("\n");

				new Notice(t("NOTICE_NUMBER_DONE"));
				break;
			case "extract-between":
				const { extractStart, extractEnd, extractRegex } =
					this.settingsState;

				if (!extractStart && !extractEnd) {
					new Notice(t("NOTICE_EXTRACT_BOUNDS"));
					return;
				}

				// 辅助函数：转义正则特殊字符
				const escapeRegExp = (str: string) =>
					str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

				let pattern: RegExp;
				try {
					if (extractRegex) {
						// 如果用户选了正则，直接构造
						pattern = new RegExp(
							`${extractStart}(.*?)${extractEnd}`,
							"g"
						);
					} else {
						// 如果是普通字符，先转义再构造，确保 (.*?) 是非贪婪匹配
						const s = escapeRegExp(extractStart);
						const e = escapeRegExp(extractEnd);
						pattern = new RegExp(`${s}(.*?)${e}`, "g");
					}

					const matches: string[] = [];
					let match;
					// 在全文中循环查找所有匹配项
					while ((match = pattern.exec(textToProcess)) !== null) {
						// match[1] 是括号中的捕获组内容
						if (match[1] !== undefined) {
							matches.push(match[1]);
						}
					}

					if (matches.length > 0) {
						processedBody = matches.join("\n");
						new Notice(
							t("NOTICE_EXTRACT_DONE", [
								matches.length.toString(),
							])
						);
					} else {
						new Notice(t("NOTICE_NO_MATCH"));
					}
				} catch (e) {
					new Notice(t("NOTICE_EXTRACT_ERROR"));
				}
				break;
			case "remove-whitespace":
				const { wsCompress, wsTrim, wsAll, wsTabs } =
					this.settingsState;
				let result = textToProcess;

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

				processedBody = result;
				new Notice(t("NOTICE_WS_DONE"));
				break;
			case "line-break-tools":
				const { lbTrigger, lbAction, lbRegex } = this.settingsState;
				if (!lbTrigger) {
					new Notice(t("NOTICE_LB_TRIGGER"));
					return;
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
						processedBody = textToProcess.replace(
							regex!,
							replacement
						);
					} else {
						// 移除操作时，由于正则已经包含了 \n，直接替换为匹配项中除换行外的部分
						processedBody = textToProcess.replace(
							regex!,
							(match) => {
								return lbAction === "remove-after"
									? match.replace(/\n$/, "")
									: match.replace(/^\n/, "");
							}
						);
					}

					new Notice(t("NOTICE_LB_DONE"));
				} catch (e) {
					new Notice(t("NOTICE_LB_ERROR"));
				}
				this.render();
				break;
			default:
				// 默认情况下，将处理后的行重新合并
				processedBody = lines.join("\n");
		}
		// --- 最终三段式拼合 ---
		this.content = extractedFrontmatter + extractedHeader + processedBody;

		this.render();

		// 动态通知提示
		let noticeMsg = t("NOTICE_PROCESS_DONE");
		if (extractedFrontmatter && extractedHeader)
			noticeMsg = t("NOTICE_SKIP_FM_AND_HEADER");
		else if (extractedFrontmatter) noticeMsg = t("NOTICE_SKIP_FRONTMATTER");
		else if (extractedHeader) noticeMsg = t("NOTICE_SKIP_HEADER");

		new Notice(noticeMsg);
	}

	// 保存回原笔记
	saveToOriginal() {
		if (this.originalEditor) {
			this.originalEditor.setValue(this.content);
			new Notice(t("NOTICE_SAVE_SUCCESS"));
		} else {
			new Notice(t("NOTICE_SAVE_ERROR"));
		}
	}

	async onClose() {
		// 清理逻辑
	}

	// 核心：处理文本前先备份
	pushToHistory() {
		// 如果当前内容和历史最后一次记录不同，才存入
		if (
			this.history.length === 0 ||
			this.history[this.history.length - 1] !== this.content
		) {
			this.history.push(this.content);
			// 超过最大步数时删除最早的记录
			if (this.history.length > this.maxHistorySize) {
				this.history.shift();
			}
		}
		// 执行了新操作，必须清空重做栈
		this.redoHistory = [];
	}

	// 撤销逻辑
	undo() {
		if (this.history.length > 0) {
			// 将当前内容存入重做栈
			this.redoHistory.push(this.content);
			const previousContent = this.history.pop();
			if (previousContent !== undefined) {
				this.content = previousContent;
				new Notice(t("NOTICE_UNDO"));
				this.render(); // 重新渲染界面
			}
		} else {
			new Notice(t("NOTICE_NO_UNDO"));
		}
	}

	// 重做逻辑
	redo() {
		if (this.redoHistory.length > 0) {
			// 将当前内容存回撤销栈
			this.history.push(this.content);

			const next = this.redoHistory.pop();
			if (next !== undefined) {
				this.content = next;
				this.render();
			}
		} else {
			new Notice(t("NOTICE_NO_REDO"));
		}
	}

	async saveToNewFile() {
		const activeFile = this.app.workspace.getActiveFile();

		// 1. 确定基础路径和文件名
		// 如果没有打开的笔记，则定位到根目录，文件名为 "未命名"
		const folderPath = activeFile?.parent ? activeFile.parent.path : "/";
		const baseName = activeFile
			? activeFile.basename
			: t("DEFAULT_FILENAME");
		const extension = activeFile ? activeFile.extension : "md";

		let newFileName = "";
		let counter = 1;
		let fileExists = true;

		while (fileExists) {
			newFileName = normalizePath(
				`${folderPath}/${baseName}_${counter}.${extension}`
			);
			const abstractFile =
				this.app.vault.getAbstractFileByPath(newFileName);
			if (!abstractFile) {
				fileExists = false;
			} else {
				counter++;
			}
		}

		try {
			// 2. 创建新文件
			const newFile = await this.app.vault.create(
				newFileName,
				this.content
			);
			new Notice(t("NOTICE_COPY_CREATED", [`${baseName}_${counter}`]));

			// 3. 在新标签页中打开这个文件
			if (newFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf("tab"); // 'tab' 表示在新标签页打开
				await leaf.openFile(newFile);

				// 可选：打开后将焦点切回新笔记
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
			}
		} catch (error) {
			console.error(error);
			new Notice(t("NOTICE_COPY_ERROR"));
		}
	}
}
