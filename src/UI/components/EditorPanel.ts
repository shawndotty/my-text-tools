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

export class EditorPanel {
	private parent: HTMLElement;
	private content: string;
	private editMode: "source" | "preview";
	private canUndo: boolean;
	private canRedo: boolean;
	private hasOriginalEditor: boolean;
	private isSelectionMode: boolean;
	private isRecording: boolean;
	private hasBatches: boolean;
	private currentFilePath: string | null;
	private callbacks: EditorPanelCallbacks;
	private app: App;

	private undoBtn: HTMLElement | null = null;
	private redoBtn: HTMLElement | null = null;
	private pathContainer: HTMLElement | null = null;
	private textAreaRef: HTMLTextAreaElement | null = null;

	private getSelectionFn: () => {
		start: number;
		end: number;
		text: string;
	} | null = () => null;
	private replaceSelectionFn: (text: string) => void = () => {};

	constructor(
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
		app: App
	) {
		this.parent = parent;
		this.content = content;
		this.editMode = editMode;
		this.canUndo = canUndo;
		this.canRedo = canRedo;
		this.hasOriginalEditor = hasOriginalEditor;
		this.isSelectionMode = isSelectionMode;
		this.isRecording = isRecording;
		this.hasBatches = hasBatches;
		this.currentFilePath = currentFilePath;
		this.callbacks = callbacks;
		this.app = app;
	}

	public render(): EditorPanelHandle {
		this.renderHeader();
		this.renderEditor();
		this.renderFooter();

		return {
			updateHistoryButtons: this.updateHistoryButtons.bind(this),
			getSelection: () => this.getSelectionFn(),
			replaceSelection: (text) => this.replaceSelectionFn(text),
			updateFilePath: this.updateFilePath.bind(this),
		};
	}

	private renderHeader() {
		const header = this.parent.createDiv({ cls: "mtt-center-header" });

		this.renderTitle(header);
		this.renderPath(header);
		this.renderActionGroup(header);
	}

	private renderTitle(header: HTMLElement) {
		const titleContainer = header.createDiv({ cls: "mtt-header-title" });
		titleContainer.createEl("span", {
			text:
				this.editMode === "source"
					? t("EDITOR_HEADER")
					: t("EDITOR_PREVIEW"),
		});

		if (this.isSelectionMode) {
			const badge = titleContainer.createSpan({ cls: "mtt-badge" });
			badge.setText(t("SelectionMode"));
			badge.style.marginLeft = "8px";
			badge.style.fontSize = "0.8em";
			badge.style.backgroundColor = "var(--interactive-accent)";
			badge.style.color = "var(--text-on-accent)";
			badge.style.padding = "2px 6px";
			badge.style.borderRadius = "4px";
		}
	}

	private renderPath(header: HTMLElement) {
		this.pathContainer = header.createDiv({ cls: "mtt-header-path" });
		this.pathContainer.style.flex = "1";
		this.pathContainer.style.textAlign = "center";
		this.pathContainer.style.overflow = "hidden";
		this.pathContainer.style.textOverflow = "ellipsis";
		this.pathContainer.style.whiteSpace = "nowrap";
		this.pathContainer.style.margin = "0 10px";
		this.pathContainer.style.fontSize = "0.85em";
		this.pathContainer.style.color = "var(--text-muted)";

		this.updateFilePath(this.currentFilePath);
	}

	private renderActionGroup(header: HTMLElement) {
		const actionGroup = header.createDiv({ cls: "mtt-action-group" });

		// Undo Button
		this.undoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_UNDO") },
		});
		setIcon(this.undoBtn, "undo-2");
		this.undoBtn.toggleClass("is-disabled", !this.canUndo);
		this.undoBtn.onclick = () => this.callbacks.onUndo();

		// Redo Button
		this.redoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_REDO") },
		});
		setIcon(this.redoBtn, "redo-2");
		this.redoBtn.toggleClass("is-disabled", !this.canRedo);
		this.redoBtn.onclick = () => this.callbacks.onRedo();

		// Mode Toggle Button
		const modeBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: {
				"aria-label":
					this.editMode === "source"
						? t("MODE_PREVIEW")
						: t("MODE_SOURCE"),
			},
		});
		setIcon(modeBtn, this.editMode === "source" ? "eye" : "code");
		modeBtn.onclick = () => this.callbacks.onModeToggle();

		// Clear Button
		const clearBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_CLEAR") },
		});
		setIcon(clearBtn, "trash-2");
		clearBtn.onclick = () => this.handleClear();
	}

	private handleClear() {
		if (this.callbacks.onPushHistory) {
			this.callbacks.onPushHistory();
		}

		if (this.textAreaRef) {
			this.textAreaRef.value = "";
			this.textAreaRef.focus();
		}

		if (this.callbacks.onContentChange) {
			this.callbacks.onContentChange("");
		}
	}

	private renderEditor() {
		const editorContainer = this.parent.createDiv({
			cls: "mtt-editor-container",
		});

		if (this.editMode === "source") {
			this.renderSourceEditor(editorContainer);
		} else {
			this.renderPreviewEditor(editorContainer);
		}
	}

	private renderSourceEditor(container: HTMLElement) {
		const ta = container.createEl("textarea", {
			cls: "mtt-textarea mtt-monospace",
		});
		this.textAreaRef = ta;
		ta.value = this.content;
		ta.oninput = (e) => {
			const newContent = (e.target as HTMLTextAreaElement).value;
			if (this.callbacks.onContentChange) {
				this.callbacks.onContentChange(newContent);
			}
		};

		this.getSelectionFn = () => {
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			if (start === end) return null;
			return { start, end, text: ta.value.substring(start, end) };
		};

		this.replaceSelectionFn = (text: string) => {
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			ta.setRangeText(text, start, end, "select");
			if (this.callbacks.onContentChange) {
				this.callbacks.onContentChange(ta.value);
			}
		};

		const handleSelection = () => {
			if (!this.callbacks.onProcessSelection) return;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			if (start === end) return;

			const selectedText = ta.value.substring(start, end);
			const processed = this.callbacks.onProcessSelection(selectedText);

			if (processed !== null && processed !== selectedText) {
				ta.setRangeText(processed, start, end, "select");
				if (this.callbacks.onContentChange) {
					this.callbacks.onContentChange(ta.value);
				}
			}
		};

		ta.onmouseup = handleSelection;
		ta.onkeyup = (e) => {
			if (e.shiftKey || e.key === "Shift") {
				handleSelection();
			}
		};
	}

	private renderPreviewEditor(container: HTMLElement) {
		const previewEl = container.createDiv({
			cls: "mtt-preview-area markdown-rendered",
		});
		MarkdownRenderer.render(
			this.app,
			this.content,
			previewEl,
			"/",
			new Component()
		);
	}

	private renderFooter() {
		const footer = this.parent.createDiv({ cls: "mtt-center-footer" });
		footer.style.justifyContent = "space-between";
		footer.style.width = "100%";
		footer.style.display = "flex";

		this.renderLeftBtnGroup(footer);

		this.renderCenterBtnGroup(footer);

		this.renderRightBtnGroup(footer);
	}

	private renderLeftBtnGroup(footer: HTMLElement) {
		const leftBtnGroup = footer.createDiv({
			cls: "mtt-footer-btn-group",
		});
		leftBtnGroup.style.display = "flex";
		leftBtnGroup.style.alignItems = "center";
		leftBtnGroup.style.gap = "8px";

		const importBtn = leftBtnGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_IMPORT") },
		});
		setIcon(importBtn, "import");

		const modeSelect = leftBtnGroup.createEl("select", {
			cls: "dropdown",
		});
		modeSelect.style.maxWidth = "130px";
		modeSelect.createEl("option", {
			value: "overwrite",
			text: t("OPTION_IMPORT_OVERWRITE"),
		});
		modeSelect.createEl("option", {
			value: "insert",
			text: t("OPTION_IMPORT_INSERT"),
		});

		const toggleContainer = leftBtnGroup.createDiv();
		toggleContainer.style.display = "none";
		toggleContainer.style.alignItems = "center";
		toggleContainer.style.gap = "4px";

		const removeFrontmatterCheckbox = toggleContainer.createEl("input", {
			type: "checkbox",
		});
		removeFrontmatterCheckbox.checked = true;

		const toggleLabel = toggleContainer.createEl("label", {
			text: t("LABEL_REMOVE_FRONTMATTER"),
		});
		toggleLabel.style.fontSize = "0.85em";
		toggleLabel.style.cursor = "pointer";
		toggleLabel.htmlFor = removeFrontmatterCheckbox.id;

		toggleLabel.onclick = () => {
			removeFrontmatterCheckbox.checked =
				!removeFrontmatterCheckbox.checked;
		};

		modeSelect.onchange = () => {
			if (modeSelect.value === "insert") {
				toggleContainer.style.display = "flex";
			} else {
				toggleContainer.style.display = "none";
			}
		};

		importBtn.onclick = (e) =>
			this.handleImport(e, modeSelect, removeFrontmatterCheckbox);
	}

	private handleImport(
		e: MouseEvent,
		modeSelect: HTMLSelectElement,
		removeFrontmatterCheckbox: HTMLInputElement
	) {
		e.preventDefault();
		e.stopPropagation();

		const mode = modeSelect.value as "overwrite" | "insert";
		const shouldRemoveFrontmatter = removeFrontmatterCheckbox.checked;

		new ImportNoteModal(this.app, (file, importedContent) => {
			let contentToUse = importedContent;

			if (mode === "insert" && shouldRemoveFrontmatter) {
				contentToUse = this.removeFrontmatter(importedContent);
			}

			let finalContent = contentToUse;
			if (this.textAreaRef) {
				if (mode === "overwrite") {
					this.textAreaRef.value = contentToUse;
				} else {
					const start = this.textAreaRef.selectionStart;
					const end = this.textAreaRef.selectionEnd;
					const text = this.textAreaRef.value;
					const before = text.substring(0, start);
					const after = text.substring(end);
					finalContent = before + contentToUse + after;
					this.textAreaRef.value = finalContent;

					const newCursorPos = start + contentToUse.length;
					this.textAreaRef.setSelectionRange(
						newCursorPos,
						newCursorPos
					);
					this.textAreaRef.focus();
				}
			}

			if (this.callbacks.onImport) {
				this.callbacks.onImport(file, finalContent, mode);
			} else if (this.callbacks.onContentChange) {
				this.callbacks.onContentChange(finalContent);
			}
			new Notice(t("NOTICE_IMPORT_SUCCESS"), 2000);
		}).open();
	}

	private removeFrontmatter(text: string): string {
		return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
	}

	private renderCenterBtnGroup(footer: HTMLElement) {
		const centerBtnGroup = footer.createDiv({
			cls: "mtt-footer-btn-group",
		});
		centerBtnGroup.style.display = "flex";
		centerBtnGroup.style.alignItems = "center";
		centerBtnGroup.style.gap = "8px";

		if (this.isRecording) {
			this.renderRecordingControls(centerBtnGroup);
		} else {
			this.renderNormalCenterControls(centerBtnGroup);
		}
	}

	private renderRecordingControls(container: HTMLElement) {
		const recIndicator = container.createSpan();
		recIndicator.setText("🔴 REC");
		recIndicator.style.color = "var(--text-error)";
		recIndicator.style.fontWeight = "bold";
		recIndicator.style.fontSize = "0.8em";
		recIndicator.style.marginRight = "4px";

		const cancelRecBtn = container.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_CANCEL_RECORDING") },
		});
		setIcon(cancelRecBtn, "x");
		cancelRecBtn.onclick = this.callbacks.onCancelRecording;

		const stopRecBtn = container.createEl("button", {
			cls: "mtt-icon-btn mod-warning",
			attr: { "aria-label": t("BTN_STOP_RECORDING") },
		});
		setIcon(stopRecBtn, "square");
		stopRecBtn.onclick = this.callbacks.onStopRecording;
	}

	private renderNormalCenterControls(container: HTMLElement) {
		if (this.hasBatches) {
			const applyBatchBtn = container.createEl("button", {
				cls: "mtt-icon-btn",
				attr: { "aria-label": t("BTN_APPLY_BATCH") },
			});
			setIcon(applyBatchBtn, "play");
			applyBatchBtn.onclick = this.callbacks.onApplyBatch;
		}

		const startRecBtn = container.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_START_RECORDING") },
		});
		setIcon(startRecBtn, "circle");
		startRecBtn.onclick = this.callbacks.onStartRecording;
	}

	private renderRightBtnGroup(footer: HTMLElement) {
		const btnGroup = footer.createDiv({ cls: "mtt-footer-btn-group" });

		// Copy Button
		const copyClipboardBtn = btnGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_COPY_CLIPBOARD") },
		});
		setIcon(copyClipboardBtn, "copy");
		copyClipboardBtn.onclick = async () => {
			try {
				await navigator.clipboard.writeText(this.content);
				new Notice(t("NOTICE_COPY_CLIPBOARD_SUCCESS"), 2000);
			} catch (err) {
				new Notice(t("NOTICE_COPY_CLIPBOARD_ERROR"), 2000);
			}
		};

		// Save New Button
		const saveNewBtn = btnGroup.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_SAVE_NEW") },
		});
		setIcon(saveNewBtn, "file-plus");
		saveNewBtn.onclick = () => this.callbacks.onSaveNew();

		// Save Original Button
		if (this.hasOriginalEditor) {
			const saveOverBtn = btnGroup.createEl("button", {
				cls: "mtt-icon-btn mod-cta",
				attr: {
					"aria-label": this.isSelectionMode
						? t("BTN_UPDATE_SELECTION" as any)
						: t("BTN_SAVE_ORIGINAL"),
				},
			});
			setIcon(saveOverBtn, "save");
			saveOverBtn.onclick = () => this.callbacks.onSaveOriginal();
		}
	}

	private updateHistoryButtons(newCanUndo: boolean, newCanRedo: boolean) {
		if (this.undoBtn) {
			this.undoBtn.toggleClass("is-disabled", !newCanUndo);
		}
		if (this.redoBtn) {
			this.redoBtn.toggleClass("is-disabled", !newCanRedo);
		}
	}

	private updateFilePath(path: string | null) {
		if (!this.pathContainer) return;

		if (path) {
			this.pathContainer.setText(path);
			this.pathContainer.title = path;
		} else {
			this.pathContainer.setText("");
			this.pathContainer.removeAttribute("title");
		}
	}
}
