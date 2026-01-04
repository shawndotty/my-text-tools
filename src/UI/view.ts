import {
	ItemView,
	WorkspaceLeaf,
	Notice,
	setIcon,
	TFile,
	normalizePath,
} from "obsidian";

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
		return "MyTextTools 工作台";
	}
	getIcon() {
		return "wrench-screwdriver-glyph";
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
		parent.createEl("h3", { text: "文本工具", cls: "mtt-panel-title" });

		const toolList = [
			{ id: "dedupe", name: "去除重复行", icon: "list-minus" },
			{ id: "empty-line", name: "删除空行", icon: "text-wrap" },
			{ id: "regex", name: "正则替换", icon: "search" },
			{ id: "add-wrap", name: "添加前后缀", icon: "wrap-text" },
			{ id: "remove-string", name: "按字符过滤行", icon: "filter" },
			{ id: "extract-column", name: "提取指定列", icon: "columns" },
			{ id: "swap-columns", name: "交换指定列", icon: "columns" },
		];

		toolList.forEach((tool) => {
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
				if (tool.id === "dedupe" || tool.id === "empty-line") {
					this.processText(tool.id);
				}
				this.render(); // 重新渲染以更新 UI 状态
			};
		});
	}

	// 中间编辑器
	renderMainEditor(parent: HTMLElement) {
		const header = parent.createDiv({ cls: "mtt-center-header" });
		header.createEl("span", { text: "临时编辑区 (不会自动保存到原笔记)" });

		// 按钮容器
		const actionGroup = header.createDiv({ cls: "mtt-action-group" });

		// 撤销按钮
		const undoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": "撤销 (Ctrl+Z)" },
		});
		setIcon(undoBtn, "undo-2");
		undoBtn.toggleClass("is-disabled", this.history.length === 0);
		undoBtn.onclick = () => this.undo();

		// 重做按钮
		const redoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": "重做 (Ctrl+Y)" },
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
			attr: { placeholder: "在此输入或处理文本..." },
		});
		textArea.value = this.content;

		textArea.oninput = (e) => {
			this.content = (e.target as HTMLTextAreaElement).value;
		};

		const footer = parent.createDiv({ cls: "mtt-center-footer" });

		// 按钮组容器，方便设置间距
		const btnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });

		// 按钮 1：存为新笔记
		const saveNewBtn = btnGroup.createEl("button", {
			text: "保存为新副本",
			cls: "mtt-secondary-btn",
		});
		saveNewBtn.onclick = () => this.saveToNewFile();

		// 按钮 2：覆盖原笔记
		const saveOverBtn = btnGroup.createEl("button", {
			text: "应用并覆盖原笔记",
			cls: "mod-cta",
		});
		saveOverBtn.onclick = () => this.saveToOriginal();
	}

	// 右侧设置面板 (核心逻辑)
	renderSettings(parent: HTMLElement) {
		parent.createEl("h3", { text: "参数设置", cls: "mtt-panel-title" });

		if (!this.activeTool) {
			parent.createEl("p", {
				text: "在左侧选择一个工具开始处理",
				cls: "mtt-empty-state",
			});
			return;
		}

		const settingsContent = parent.createDiv({
			cls: "mtt-settings-content",
		});

		if (this.activeTool === "remove-string") {
			settingsContent.createEl("label", { text: "匹配字符串/正则:" });
			const filterInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: "输入关键字...",
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
			modeDiv.createEl("label", { text: "模式:" });
			const modeSelect = modeDiv.createEl("select");
			modeSelect.createEl("option", {
				text: "删除包含该字符的行",
				value: "containing",
			});
			modeSelect.createEl("option", {
				text: "删除不包含该字符的行",
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
			caseLabel.appendText(" 区分大小写");

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
			regexLabel.appendText(" 启用正则匹配");

			const runBtn = settingsContent.createEl("button", {
				text: "执行过滤",
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("remove-string");
		} else if (this.activeTool === "regex") {
			settingsContent.createEl("label", { text: "查找 (Regex):" });
			const findInput = settingsContent.createEl("input", {
				type: "text",
				value: this.settingsState.findText,
			});
			findInput.onchange = (e) =>
				(this.settingsState.findText = (
					e.target as HTMLInputElement
				).value);

			settingsContent.createEl("label", { text: "替换为:" });
			const replaceInput = settingsContent.createEl("input", {
				type: "text",
				value: this.settingsState.replaceText,
			});
			replaceInput.onchange = (e) =>
				(this.settingsState.replaceText = (
					e.target as HTMLInputElement
				).value);

			const runBtn = settingsContent.createEl("button", {
				text: "执行替换",
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("regex");
		} else if (this.activeTool === "add-wrap") {
			settingsContent.createEl("label", { text: "行首添加:" });
			const preInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: "例如: - ",
			});
			preInput.onchange = (e) =>
				(this.settingsState.prefix = (
					e.target as HTMLInputElement
				).value);

			const runBtn = settingsContent.createEl("button", {
				text: "执行添加",
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("add-wrap");
		} else if (this.activeTool === "extract-column") {
			settingsContent.createEl("label", { text: "选择分隔符:" });
			const delimSelect = settingsContent.createEl("select", {
				cls: "mtt-select",
			});
			delimSelect.createEl("option", { text: "逗号 (,)", value: "," });
			delimSelect.createEl("option", {
				text: "制表符 (Tab)",
				value: "\t",
			});
			delimSelect.createEl("option", { text: "竖线 (|)", value: "|" });
			delimSelect.createEl("option", { text: "空格", value: " " });
			delimSelect.createEl("option", { text: "自定义", value: "custom" });

			delimSelect.value = this.settingsState.columnDelimiter;

			// 如果是自定义，显示输入框
			const customInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: "输入自定义字符",
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
				text: "提取第几列 (从1开始):",
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
				text: "提取列",
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("extract-column");
		} else if (this.activeTool === "swap-columns") {
			settingsContent.createEl("label", { text: "选择分隔符:" });
			const delimSelect = settingsContent.createEl("select", {
				cls: "mtt-select",
			});
			delimSelect.createEl("option", { text: "逗号 (,)", value: "," });
			delimSelect.createEl("option", {
				text: "制表符 (Tab)",
				value: "\t",
			});
			delimSelect.createEl("option", { text: "竖线 (|)", value: "|" });
			delimSelect.createEl("option", { text: "空格", value: " " });
			delimSelect.createEl("option", { text: "自定义", value: "custom" });

			delimSelect.value = this.settingsState.columnDelimiterSC;

			// 如果是自定义，显示输入框
			const customInput = settingsContent.createEl("input", {
				type: "text",
				placeholder: "输入自定义字符",
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

			colInputGroup.createSpan({ text: "交换第" });
			const input1 = colInputGroup.createEl("input", {
				type: "number",
				cls: "mtt-number-input",
				value: this.settingsState.swapCol1.toString(),
			});
			input1.onchange = (e) =>
				(this.settingsState.swapCol1 =
					parseInt((e.target as HTMLInputElement).value) || 1);

			colInputGroup.createSpan({ text: "列 与 第" });
			const input2 = colInputGroup.createEl("input", {
				type: "number",
				cls: "mtt-number-input",
				value: this.settingsState.swapCol2.toString(),
			});
			input2.onchange = (e) =>
				(this.settingsState.swapCol2 =
					parseInt((e.target as HTMLInputElement).value) || 1);

			colInputGroup.createSpan({ text: "列" });

			const runBtn = settingsContent.createEl("button", {
				text: "执行交换",
				cls: "mtt-run-btn",
			});
			runBtn.onclick = () => this.processText("swap-columns");
		} else {
			settingsContent.createEl("p", {
				text: "该工具无需额外设置，点击左侧按钮已直接触发。",
			});
		}
	}

	// 统一处理文本逻辑
	processText(type: string) {
		this.pushToHistory(); // 执行处理前，先记录当前状态
		let lines = this.content.split("\n");

		switch (type) {
			case "dedupe":
				this.content = Array.from(new Set(lines)).join("\n");
				new Notice("已去除重复行");
				break;
			case "empty-line":
				this.content = lines.filter((l) => l.trim() !== "").join("\n");
				new Notice("已删除空行");
				break;
			case "regex":
				try {
					const regex = new RegExp(this.settingsState.findText, "g");
					this.content = this.content.replace(
						regex,
						this.settingsState.replaceText
					);
					new Notice("正则替换完成");
				} catch (e) {
					new Notice("正则表达式错误！");
				}
				break;
			case "add-wrap":
				this.content = lines
					.map((l) => (this.settingsState.prefix || "") + l)
					.join("\n");
				new Notice("已添加行首内容");
				break;
			case "remove-string":
				const { filterText, filterMode, filterCase, filterRegex } =
					this.settingsState;

				if (!filterText) {
					new Notice("请输入要过滤的字符");
					return;
				}

				this.content = lines
					.filter((line) => {
						let isMatch = false;

						if (filterRegex) {
							try {
								const flags = filterCase ? "g" : "gi";
								const regex = new RegExp(filterText, flags);
								isMatch = regex.test(line);
							} catch (e) {
								new Notice("正则表达式有误");
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

				new Notice(`已根据条件过滤行`);
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
					new Notice("请输入自定义分隔符");
					return;
				}

				const colIndex = columnNumber - 1; // 转为数组索引
				this.content = lines
					.map((line) => {
						const parts = line.split(actualDelim);
						// 如果该行有这一列，返回内容；否则返回空字符串
						return parts.length > colIndex
							? parts[colIndex]?.trim()
							: "";
					})
					.filter((val) => val !== "") // 可选：过滤掉无法提取的行（空结果）
					.join("\n");

				new Notice(`已提取第 ${columnNumber} 列`);
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
					new Notice("请指定分隔符");
					return;
				}

				const idx1 = swapCol1 - 1;
				const idx2 = swapCol2 - 1;

				this.content = lines
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

				new Notice(`已交换第 ${swapCol1} 和 ${swapCol2} 列`);
				break;
		}
		this.render(); // 刷新 UI 显示新内容
	}

	// 保存回原笔记
	saveToOriginal() {
		if (this.originalEditor) {
			this.originalEditor.setValue(this.content);
			new Notice("✅ 已保存到笔记");
		} else {
			new Notice("❌ 错误：找不到原笔记编辑器");
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
				new Notice("已撤销");
				this.render(); // 重新渲染界面
			}
		} else {
			new Notice("没有可以撤销的历史记录");
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
			new Notice("没有可以重做的记录");
		}
	}

	// 在 MyTextToolsView 类中添加
	async saveToNewFile() {
		if (!this.originalEditor || !this.app.workspace.getActiveFile()) {
			new Notice("无法获取原笔记路径");
			return;
		}

		const activeFile = this.app.workspace.getActiveFile() as TFile;
		const folderPath = activeFile.parent ? activeFile.parent.path : "/";
		const baseName = activeFile.basename;
		const extension = activeFile.extension;

		let newFileName = "";
		let counter = 1;
		let fileExists = true;

		// 循环检测，直到找到一个不存在的文件名（如：原文件名 1.md）
		while (fileExists) {
			newFileName = normalizePath(
				`${folderPath}/${baseName} ${counter}.${extension}`
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
			// 创建新文件
			await this.app.vault.create(newFileName, this.content);
			new Notice(`✅ 已成功创建新笔记：${baseName} ${counter}`);

			// 可选：创建后自动打开这个新文件
			// const newFile = this.app.vault.getAbstractFileByPath(newFileName);
			// if (newFile instanceof TFile) {
			//     await this.app.workspace.getLeaf().openFile(newFile);
			// }
		} catch (error) {
			console.error(error);
			new Notice("❌ 创建新笔记失败");
		}
	}
}
