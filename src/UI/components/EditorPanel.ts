import { Notice, setIcon, MarkdownRenderer, Component } from "obsidian";
import { t } from "../../lang/helpers";

export interface EditorPanelCallbacks {
	onUndo: () => void;
	onRedo: () => void;
	onModeToggle: () => void;
	onCopy: () => void;
	onSaveNew: () => void;
	onSaveOriginal: () => void;
	onContentChange?: (content: string) => void;
	onProcessSelection?: (text: string) => string | null;
}

export interface EditorPanelHandle {
	updateHistoryButtons: (canUndo: boolean, canRedo: boolean) => void;
	getSelection: () => { start: number; end: number; text: string } | null;
	replaceSelection: (text: string) => void;
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
	isSelectionMode: boolean, // 新增参数
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

	// 内容区域
	const editorContainer = parent.createDiv({
		cls: "mtt-editor-container",
	});

	let getSelection: EditorPanelHandle["getSelection"] = () => null;
	let replaceSelection: EditorPanelHandle["replaceSelection"] = () => {};

	if (editMode === "source") {
		// 源码模式：使用 textarea 处理
		const ta = editorContainer.createEl("textarea", {
			cls: "mtt-textarea mtt-monospace",
		});
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

	// 按钮组容器，方便设置间距
	const btnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });

	// 1. 复制到剪贴板按钮
	const copyClipboardBtn = btnGroup.createEl("button", {
		text: t("BTN_COPY_CLIPBOARD"),
		cls: "mtt-secondary-btn",
	});

	copyClipboardBtn.onclick = async () => {
		try {
			await navigator.clipboard.writeText(content);
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
	saveNewBtn.onclick = () => callbacks.onSaveNew();

	// 按钮 2：覆盖原笔记
	if (hasOriginalEditor) {
		const saveOverBtn = btnGroup.createEl("button", {
			text: isSelectionMode
				? t("BTN_UPDATE_SELECTION" as any)
				: t("BTN_SAVE_ORIGINAL"),
			cls: "mod-cta",
		});
		saveOverBtn.onclick = () => callbacks.onSaveOriginal();
	}

	return { updateHistoryButtons, getSelection, replaceSelection };
}
