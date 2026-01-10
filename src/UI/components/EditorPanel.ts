import {
	Notice,
	setIcon,
	MarkdownRenderer,
	Component,
	App,
	TFile,
} from "obsidian";
import { t } from "../../lang/helpers";
import { ImportNoteModal } from "../modals/ImportNoteModal";

export interface EditorPanelCallbacks {
	onUndo: () => void;
	onRedo: () => void;
	onModeToggle: () => void;
	onCopy: () => void;
	onSaveNew: () => void;
	onSaveOriginal: () => void;
	onImport?: (
		file: TFile,
		content: string,
		mode: "overwrite" | "insert"
	) => void;
	onContentChange?: (content: string) => void;
	onProcessSelection?: (text: string) => string | null;
	onPushHistory?: () => void;
	onStartRecording: () => void;
	onStopRecording: () => void;
	onCancelRecording: () => void;
	onApplyBatch: () => void;
}

export interface EditorPanelHandle {
	updateHistoryButtons: (canUndo: boolean, canRedo: boolean) => void;
	getSelection: () => { start: number; end: number; text: string } | null;
	replaceSelection: (text: string) => void;
	updateFilePath: (path: string | null) => void;
}

/**
 * 渲染编辑器面板
 */
export function renderEditorPanel(
	parent: HTMLElement,
	content: string,
	editMode: "source" | "preview",
	canUndo: boolean,
	canRedo: boolean,
	hasOriginalEditor: boolean,
	isSelectionMode: boolean,
	isRecording: boolean,
	hasBatches: boolean,
	currentFilePath: string | null,
	callbacks: EditorPanelCallbacks,
	app: any
): EditorPanelHandle {
	const header = parent.createDiv({ cls: "mtt-center-header" });

	const titleContainer = header.createDiv({ cls: "mtt-header-title" });
	titleContainer.createEl("span", {
		text: editMode === "source" ? t("EDITOR_HEADER") : t("EDITOR_PREVIEW"),
	});

	if (isSelectionMode) {
		const badge = titleContainer.createSpan({ cls: "mtt-badge" });
		badge.setText(t("SelectionMode"));
		badge.style.marginLeft = "8px";
		badge.style.fontSize = "0.8em";
		badge.style.backgroundColor = "var(--interactive-accent)";
		badge.style.color = "var(--text-on-accent)";
		badge.style.padding = "2px 6px";
		badge.style.borderRadius = "4px";
	}

	// 显示当前文件路径
	const pathContainer = header.createDiv({ cls: "mtt-header-path" });
	pathContainer.style.flex = "1";
	pathContainer.style.textAlign = "center";
	pathContainer.style.overflow = "hidden";
	pathContainer.style.textOverflow = "ellipsis";
	pathContainer.style.whiteSpace = "nowrap";
	pathContainer.style.margin = "0 10px";
	pathContainer.style.fontSize = "0.85em";
	pathContainer.style.color = "var(--text-muted)";

	const updateFilePath = (path: string | null) => {
		if (path) {
			pathContainer.setText(path);
			pathContainer.title = path;
		} else {
			pathContainer.setText("");
			pathContainer.removeAttribute("title");
		}
	};

	// 初始化路径显示
	updateFilePath(currentFilePath);

	// 按钮容器
	const actionGroup = header.createDiv({ cls: "mtt-action-group" });

	// 撤销按钮
	const undoBtn = actionGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: { "aria-label": t("BTN_UNDO") },
	});
	setIcon(undoBtn, "undo-2");
	undoBtn.toggleClass("is-disabled", !canUndo);
	undoBtn.onclick = () => callbacks.onUndo();

	// 重做按钮
	const redoBtn = actionGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: { "aria-label": t("BTN_REDO") },
	});
	setIcon(redoBtn, "redo-2");
	redoBtn.toggleClass("is-disabled", !canRedo);
	redoBtn.onclick = () => callbacks.onRedo();

	// 定义更新按钮状态的函数
	const updateHistoryButtons = (newCanUndo: boolean, newCanRedo: boolean) => {
		undoBtn.toggleClass("is-disabled", !newCanUndo);
		redoBtn.toggleClass("is-disabled", !newCanRedo);
	};

	// 模式切换按钮
	const modeBtn = actionGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: {
			"aria-label":
				editMode === "source" ? t("MODE_PREVIEW") : t("MODE_SOURCE"),
		},
	});
	setIcon(modeBtn, editMode === "source" ? "eye" : "code");
	modeBtn.onclick = () => callbacks.onModeToggle();

	// 清空内容按钮
	const clearBtn = actionGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: { "aria-label": t("BTN_CLEAR") },
	});
	setIcon(clearBtn, "trash-2");
	clearBtn.onclick = () => {
		// 保存历史记录
		if (callbacks.onPushHistory) {
			callbacks.onPushHistory();
		}

		if (textAreaRef) {
			textAreaRef.value = "";
			textAreaRef.focus();
		}
		// 无论是在源码模式还是预览模式，都通知内容变更为""
		if (callbacks.onContentChange) {
			callbacks.onContentChange("");
		}
	};

	// 内容区域
	const editorContainer = parent.createDiv({
		cls: "mtt-editor-container",
	});

	let getSelection: EditorPanelHandle["getSelection"] = () => null;
	let replaceSelection: EditorPanelHandle["replaceSelection"] = () => {};
	let textAreaRef: HTMLTextAreaElement | null = null;

	if (editMode === "source") {
		// 源码模式：使用 textarea 处理
		const ta = editorContainer.createEl("textarea", {
			cls: "mtt-textarea mtt-monospace",
		});
		textAreaRef = ta;
		// 显式设置值，防止属性注入失败
		ta.value = content;
		ta.oninput = (e) => {
			// 内容更新需要通过回调通知父组件
			const newContent = (e.target as HTMLTextAreaElement).value;
			if (callbacks.onContentChange) {
				callbacks.onContentChange(newContent);
			}
		};

		getSelection = () => {
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			if (start === end) return null;
			return { start, end, text: ta.value.substring(start, end) };
		};

		replaceSelection = (text: string) => {
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			ta.setRangeText(text, start, end, "select");
			if (callbacks.onContentChange) {
				callbacks.onContentChange(ta.value);
			}
		};

		// On-select 处理逻辑
		const handleSelection = () => {
			if (!callbacks.onProcessSelection) return;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			if (start === end) return; // 没有选中

			const selectedText = ta.value.substring(start, end);
			const processed = callbacks.onProcessSelection(selectedText);

			if (processed !== null && processed !== selectedText) {
				// 替换选区
				ta.setRangeText(processed, start, end, "select");
				// 更新内容
				if (callbacks.onContentChange) {
					callbacks.onContentChange(ta.value);
				}
			}
		};

		ta.onmouseup = handleSelection;
		ta.onkeyup = (e) => {
			// 仅在 Shift+方向键或其他可能改变选区的键释放时检查
			if (e.shiftKey || e.key === "Shift") {
				handleSelection();
			}
		};
	} else {
		// 预览模式：使用 Obsidian 原生渲染器
		const previewEl = editorContainer.createDiv({
			cls: "mtt-preview-area markdown-rendered",
		});
		// 核心渲染逻辑
		MarkdownRenderer.render(app, content, previewEl, "/", new Component());
	}

	const footer = parent.createDiv({ cls: "mtt-center-footer" });
	footer.style.justifyContent = "space-between";
	footer.style.width = "100%";
	footer.style.display = "flex";

	// 左侧按钮组 (新增)
	const leftBtnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });
	leftBtnGroup.style.display = "flex";
	leftBtnGroup.style.alignItems = "center";
	leftBtnGroup.style.gap = "8px";

	const importBtn = leftBtnGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: { "aria-label": t("BTN_IMPORT") },
	});
	setIcon(importBtn, "import");

	// 导入模式选择
	const modeSelect = leftBtnGroup.createEl("select", { cls: "dropdown" });
	modeSelect.style.maxWidth = "130px";
	// 覆盖现有内容
	modeSelect.createEl("option", {
		value: "overwrite",
		text: t("OPTION_IMPORT_OVERWRITE"),
	});
	// 在光标处插入
	modeSelect.createEl("option", {
		value: "insert",
		text: t("OPTION_IMPORT_INSERT"),
	});

	// 移除属性开关容器
	const toggleContainer = leftBtnGroup.createDiv();
	toggleContainer.style.display = "none"; // 默认隐藏 (overwrite模式)
	toggleContainer.style.alignItems = "center";
	toggleContainer.style.gap = "4px";

	const removeFrontmatterCheckbox = toggleContainer.createEl("input", {
		type: "checkbox",
	});
	removeFrontmatterCheckbox.checked = true; // 默认移除

	const toggleLabel = toggleContainer.createEl("label", {
		text: t("LABEL_REMOVE_FRONTMATTER"),
	});
	toggleLabel.style.fontSize = "0.85em";
	toggleLabel.style.cursor = "pointer";
	toggleLabel.htmlFor = removeFrontmatterCheckbox.id; // 关联 label 和 checkbox (需设置 id)

	// 手动绑定 label 点击事件作为兜底
	toggleLabel.onclick = () => {
		removeFrontmatterCheckbox.checked = !removeFrontmatterCheckbox.checked;
	};

	// 监听模式变化
	modeSelect.onchange = () => {
		if (modeSelect.value === "insert") {
			toggleContainer.style.display = "flex";
		} else {
			toggleContainer.style.display = "none";
		}
	};

	// 移除 Frontmatter 的辅助函数
	const removeFrontmatter = (text: string): string => {
		return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
	};

	importBtn.onclick = (e) => {
		e.preventDefault();
		e.stopPropagation();

		const mode = modeSelect.value as "overwrite" | "insert";
		const shouldRemoveFrontmatter = removeFrontmatterCheckbox.checked;

		new ImportNoteModal(app, (file, importedContent) => {
			let contentToUse = importedContent;

			// 仅在插入模式下检查是否需要移除属性
			if (mode === "insert" && shouldRemoveFrontmatter) {
				contentToUse = removeFrontmatter(importedContent);
			}

			let finalContent = contentToUse;
			if (textAreaRef) {
				if (mode === "overwrite") {
					textAreaRef.value = contentToUse;
				} else {
					// 插入模式
					const start = textAreaRef.selectionStart;
					const end = textAreaRef.selectionEnd;
					const text = textAreaRef.value;
					const before = text.substring(0, start);
					const after = text.substring(end);
					finalContent = before + contentToUse + after;
					textAreaRef.value = finalContent;

					// 移动光标到插入内容之后
					const newCursorPos = start + contentToUse.length;
					textAreaRef.setSelectionRange(newCursorPos, newCursorPos);
					textAreaRef.focus();
				}
				// 移除手动 dispatchEvent，避免重复触发 onContentChange，因为 onImport 回调已经处理了内容更新
				// textAreaRef.dispatchEvent(new Event("input"));
			}

			if (callbacks.onImport) {
				callbacks.onImport(file, finalContent, mode);
			} else if (callbacks.onContentChange) {
				callbacks.onContentChange(finalContent);
			}
			new Notice(t("NOTICE_IMPORT_SUCCESS"), 2000);
		}).open();
	};

	// 中间录制控制按钮组
	const centerBtnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });
	centerBtnGroup.style.display = "flex";
	centerBtnGroup.style.alignItems = "center";
	centerBtnGroup.style.gap = "8px";

	if (isRecording) {
		// 录制中：显示取消和停止
		const recIndicator = centerBtnGroup.createSpan();
		recIndicator.setText("🔴 REC");
		recIndicator.style.color = "var(--text-error)";
		recIndicator.style.fontWeight = "bold";
		recIndicator.style.fontSize = "0.8em";
		recIndicator.style.marginRight = "4px";

		const cancelRecBtn = centerBtnGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_CANCEL_RECORDING") },
		});
		setIcon(cancelRecBtn, "x");
		cancelRecBtn.onclick = callbacks.onCancelRecording;

		const stopRecBtn = centerBtnGroup.createEl("button", {
			cls: "mtt-icon-btn mod-warning",
			attr: { "aria-label": t("BTN_STOP_RECORDING") },
		});
		setIcon(stopRecBtn, "square");
		stopRecBtn.onclick = callbacks.onStopRecording;
	} else {
		// 未录制：显示应用批处理（如果有）和开始录制
		if (hasBatches) {
			const applyBatchBtn = centerBtnGroup.createEl("button", {
				cls: "mtt-icon-btn",
				attr: { "aria-label": t("BTN_APPLY_BATCH") },
			});
			setIcon(applyBatchBtn, "play");
			applyBatchBtn.onclick = callbacks.onApplyBatch;
		}

		const startRecBtn = centerBtnGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_START_RECORDING") },
		});
		setIcon(startRecBtn, "circle");
		startRecBtn.onclick = callbacks.onStartRecording;
	}

	// 按钮组容器，方便设置间距
	const btnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });

	// 1. 复制到剪贴板按钮
	const copyClipboardBtn = btnGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: { "aria-label": t("BTN_COPY_CLIPBOARD") },
	});
	setIcon(copyClipboardBtn, "copy");

	copyClipboardBtn.onclick = async () => {
		try {
			await navigator.clipboard.writeText(content);
			new Notice(t("NOTICE_COPY_CLIPBOARD_SUCCESS"), 2000);
		} catch (err) {
			new Notice(t("NOTICE_COPY_CLIPBOARD_ERROR"), 2000);
		}
	};

	// 按钮 1：存为新笔记
	const saveNewBtn = btnGroup.createEl("button", {
		cls: "mtt-icon-btn",
		attr: { "aria-label": t("BTN_SAVE_NEW") },
	});
	setIcon(saveNewBtn, "file-plus");
	saveNewBtn.onclick = () => callbacks.onSaveNew();

	// 按钮 2：覆盖原笔记
	if (hasOriginalEditor) {
		const saveOverBtn = btnGroup.createEl("button", {
			cls: "mtt-icon-btn mod-cta",
			attr: {
				"aria-label": isSelectionMode
					? t("BTN_UPDATE_SELECTION" as any)
					: t("BTN_SAVE_ORIGINAL"),
			},
		});
		setIcon(saveOverBtn, "save");
		saveOverBtn.onclick = () => callbacks.onSaveOriginal();
	}

	return {
		updateHistoryButtons,
		getSelection,
		replaceSelection,
		updateFilePath,
	};
}
