import {
	Notice,
	setIcon,
	MarkdownRenderer,
	Component,
	App,
	TFile,
	setTooltip,
} from "obsidian";
import {
	EditorView,
	keymap,
	highlightSpecialChars,
	drawSelection,
	dropCursor,
	ViewUpdate,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { t } from "../../lang/helpers";
import { ImportNoteModal } from "../modals/ImportNoteModal";
import {
	regexHighlightPlugin,
	highlightTheme,
	setRegexPattern,
	currentRegexField,
} from "../editor-extensions/regex-highlight";

const baseTheme = EditorView.baseTheme({
	"&": {
		height: "100%",
		fontSize: "var(--font-text-size)",
	},
	".cm-content": {
		caretColor: "var(--text-normal)",
		// fontFamily: "var(--font-monospace)",
	},
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--text-normal)",
	},
	// Apply Obsidian selection color to CodeMirror's drawn selection
	"& .cm-selectionBackground": {
		backgroundColor: "var(--text-selection) !important",
	},
	"&.cm-focused .cm-selectionBackground": {
		backgroundColor: "var(--text-selection) !important",
	},
});

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
		mode: "overwrite" | "insert",
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
	updateRegexHighlight: (pattern: string, flags: string) => void;
}

export class EditorPanel {
	private parent: HTMLElement;
	private content: string;
	private editMode: "source" | "preview" | "split";
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
	private editorView: EditorView | null = null;

	private getSelectionFn: () => {
		start: number;
		end: number;
		text: string;
	} | null = () => null;
	private replaceSelectionFn: (text: string) => void = () => {};
	private updateRegexHighlightFn: (pattern: string, flags: string) => void =
		() => {};

	constructor(
		parent: HTMLElement,
		content: string,
		editMode: "source" | "preview" | "split",
		canUndo: boolean,
		canRedo: boolean,
		hasOriginalEditor: boolean,
		isSelectionMode: boolean,
		isRecording: boolean,
		hasBatches: boolean,
		currentFilePath: string | null,
		callbacks: EditorPanelCallbacks,
		app: App,
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
			updateRegexHighlight: (p, f) => this.updateRegexHighlightFn(p, f),
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
		let titleText = t("EDITOR_HEADER");
		if (this.editMode === "preview") titleText = t("EDITOR_PREVIEW");
		if (this.editMode === "split") titleText = "Split View";

		titleContainer.createEl("span", {
			text: titleText,
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
		});
		setIcon(this.undoBtn, "undo-2");
		setTooltip(this.undoBtn, t("BTN_UNDO"), {
			placement: "bottom",
			delay: 300,
		});
		this.undoBtn.toggleClass("is-disabled", !this.canUndo);
		this.undoBtn.onclick = () => this.callbacks.onUndo();

		// Redo Button
		this.redoBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
		});
		setIcon(this.redoBtn, "redo-2");
		setTooltip(this.redoBtn, t("BTN_REDO"), {
			placement: "bottom",
			delay: 300,
		});
		this.redoBtn.toggleClass("is-disabled", !this.canRedo);
		this.redoBtn.onclick = () => this.callbacks.onRedo();

		// Mode Toggle Button
		let nextModeIcon = "eye";
		let nextModeLabel = t("MODE_PREVIEW");

		if (this.editMode === "source") {
			nextModeIcon = "eye";
			nextModeLabel = t("MODE_PREVIEW");
		} else if (this.editMode === "preview") {
			nextModeIcon = "columns";
			nextModeLabel = "Split View";
		} else {
			nextModeIcon = "code";
			nextModeLabel = t("MODE_SOURCE");
		}

		const modeBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
		});
		setIcon(modeBtn, nextModeIcon);
		setTooltip(modeBtn, nextModeLabel, {
			placement: "bottom",
			delay: 300,
		});
		modeBtn.onclick = () => this.callbacks.onModeToggle();

		// Select All Button
		const selectAllBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
		});
		setIcon(selectAllBtn, "check-square");
		setTooltip(selectAllBtn, t("BTN_SELECT_ALL"), {
			placement: "bottom",
			delay: 300,
		});
		selectAllBtn.onclick = () => this.handleSelectAll();

		// Clear Button
		const clearBtn = actionGroup.createEl("button", {
			cls: "mtt-icon-btn",
		});
		setIcon(clearBtn, "trash-2");
		setTooltip(clearBtn, t("BTN_CLEAR"), {
			placement: "bottom",
			delay: 300,
		});
		clearBtn.onclick = () => this.handleClear();
	}

	private handleSelectAll() {
		if (this.editorView) {
			this.editorView.dispatch({
				selection: {
					anchor: 0,
					head: this.editorView.state.doc.length,
				},
			});
			this.editorView.focus();
		}
	}

	private handleClear() {
		if (this.callbacks.onPushHistory) {
			this.callbacks.onPushHistory();
		}

		if (this.editorView) {
			this.editorView.dispatch({
				changes: {
					from: 0,
					to: this.editorView.state.doc.length,
					insert: "",
				},
			});
			this.editorView.focus();
		}

		if (this.callbacks.onContentChange) {
			this.callbacks.onContentChange("");
		}
	}

	private renderEditor() {
		const editorContainer = this.parent.createDiv({
			cls: "mtt-editor-container",
		});

		if (this.editMode === "split") {
			editorContainer.style.display = "flex";
			editorContainer.style.flexDirection = "row";
			editorContainer.style.overflow = "hidden";

			const leftPane = editorContainer.createDiv({
				cls: "mtt-split-left",
			});
			leftPane.style.flex = "1";
			leftPane.style.height = "100%";
			leftPane.style.overflow = "hidden";
			leftPane.style.display = "flex";
			leftPane.style.flexDirection = "column";

			const rightPane = editorContainer.createDiv({
				cls: "mtt-split-right",
			});
			rightPane.style.flex = "1";
			rightPane.style.height = "100%";
			rightPane.style.overflow = "auto";
			rightPane.style.borderLeft =
				"1px solid var(--background-modifier-border)";
			rightPane.style.paddingLeft = "10px";

			this.renderSourceEditor(leftPane);
			this.renderPreviewEditor(rightPane);
		} else if (this.editMode === "source") {
			this.renderSourceEditor(editorContainer);
		} else {
			this.renderPreviewEditor(editorContainer);
		}
	}

	private renderSourceEditor(container: HTMLElement) {
		// Use CodeMirror EditorView
		const editorParent = container.createDiv({ cls: "mtt-cm-editor" });
		editorParent.style.height = "100%";
		editorParent.style.overflow = "hidden"; // Let CM handle scroll

		const state = EditorState.create({
			doc: this.content,
			extensions: [
				highlightSpecialChars(),
				history(),
				drawSelection(),
				dropCursor(),
				EditorState.allowMultipleSelections.of(true),
				keymap.of([...defaultKeymap, ...historyKeymap]),
				EditorView.lineWrapping,
				EditorView.updateListener.of((update: ViewUpdate) => {
					if (update.docChanged) {
						const newContent = update.state.doc.toString();
						if (this.callbacks.onContentChange) {
							this.callbacks.onContentChange(newContent);
						}
						if (this.editMode === "split") {
							this.updateSplitPreview(newContent);
						}
					}
				}),
				regexHighlightPlugin,
				highlightTheme,
				baseTheme,
				currentRegexField,
			],
		});

		this.editorView = new EditorView({
			state,
			parent: editorParent,
		});

		// Bind methods
		this.getSelectionFn = () => {
			if (!this.editorView) return null;
			const selection = this.editorView.state.selection.main;
			if (selection.empty) return null;
			return {
				start: selection.from,
				end: selection.to,
				text: this.editorView.state.sliceDoc(
					selection.from,
					selection.to,
				),
			};
		};

		this.replaceSelectionFn = (text: string) => {
			if (!this.editorView) return;
			const transaction = this.editorView.state.replaceSelection(text);
			this.editorView.dispatch(transaction);
			// onContentChange will be triggered by updateListener
		};

		this.updateRegexHighlightFn = (pattern: string, flags: string) => {
			if (!this.editorView) return;
			this.editorView.dispatch({
				effects: setRegexPattern.of({ pattern, flags }),
			});
		};

		// Handle on-select tool logic
		const handleSelection = () => {
			if (!this.callbacks.onProcessSelection || !this.editorView) return;
			const selection = this.editorView.state.selection.main;
			if (selection.empty) return;

			const selectedText = this.editorView.state.sliceDoc(
				selection.from,
				selection.to,
			);
			const processed = this.callbacks.onProcessSelection(selectedText);

			if (processed !== null && processed !== selectedText) {
				const transaction =
					this.editorView.state.replaceSelection(processed);
				this.editorView.dispatch(transaction);
			}
		};

		// Attach events to DOM
		this.editorView.contentDOM.addEventListener("mouseup", handleSelection);
		this.editorView.contentDOM.addEventListener("keyup", (e) => {
			if (e.shiftKey || e.key === "Shift") {
				handleSelection();
			}
		});
	}

	private updateSplitPreview(newContent: string) {
		const rightPane = this.parent.querySelector(".mtt-split-right");
		if (rightPane) {
			rightPane.empty();
			MarkdownRenderer.render(
				this.app,
				newContent,
				rightPane as HTMLElement,
				"/",
				new Component(),
			);
		}
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
			new Component(),
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
		setTooltip(importBtn, t("BTN_IMPORT"), {
			placement: "top",
			delay: 300,
		});

		const modeSelect = leftBtnGroup.createEl("select", {
			cls: "dropdown",
		});
		modeSelect.style.maxWidth = "130px";
		if (!this.isSelectionMode) {
			modeSelect.createEl("option", {
				value: "overwrite",
				text: t("OPTION_IMPORT_OVERWRITE"),
			});
		}
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
		removeFrontmatterCheckbox: HTMLInputElement,
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

			if (this.editorView) {
				if (mode === "overwrite") {
					this.editorView.dispatch({
						changes: {
							from: 0,
							to: this.editorView.state.doc.length,
							insert: contentToUse,
						},
					});
					finalContent = contentToUse;
				} else {
					// Insert at cursor
					const transaction =
						this.editorView.state.replaceSelection(contentToUse);
					this.editorView.dispatch(transaction);
					finalContent = this.editorView.state.doc.toString();
					this.editorView.focus();
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
		setTooltip(cancelRecBtn, t("BTN_CANCEL_RECORDING"), {
			placement: "top",
			delay: 300,
		});
		cancelRecBtn.onclick = this.callbacks.onCancelRecording;

		const stopRecBtn = container.createEl("button", {
			cls: "mtt-icon-btn mod-warning",
			attr: { "aria-label": t("BTN_STOP_RECORDING") },
		});
		setIcon(stopRecBtn, "square");
		setTooltip(stopRecBtn, t("BTN_STOP_RECORDING"), {
			placement: "top",
			delay: 300,
		});
		stopRecBtn.onclick = this.callbacks.onStopRecording;
	}

	private renderNormalCenterControls(container: HTMLElement) {
		if (this.hasBatches) {
			const applyBatchBtn = container.createEl("button", {
				cls: "mtt-icon-btn",
				attr: { "aria-label": t("BTN_APPLY_BATCH") },
			});
			setIcon(applyBatchBtn, "play");
			setTooltip(applyBatchBtn, t("BTN_APPLY_BATCH"), {
				placement: "top",
				delay: 300,
			});
			applyBatchBtn.onclick = this.callbacks.onApplyBatch;
		}

		const startRecBtn = container.createEl("button", {
			cls: "mtt-icon-btn",
			attr: { "aria-label": t("BTN_START_RECORDING") },
		});
		setIcon(startRecBtn, "circle");
		setTooltip(startRecBtn, t("BTN_START_RECORDING"), {
			placement: "top",
			delay: 300,
		});
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
		setTooltip(copyClipboardBtn, t("BTN_COPY_CLIPBOARD"), {
			placement: "top",
			delay: 300,
		});
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
		setTooltip(saveNewBtn, t("BTN_SAVE_NEW"), {
			placement: "top",
			delay: 300,
		});
		saveNewBtn.onclick = () => this.callbacks.onSaveNew();

		// Save Original Button
		if (this.hasOriginalEditor) {
			const label = this.isSelectionMode
				? t("BTN_UPDATE_SELECTION")
				: t("BTN_SAVE_ORIGINAL");
			const saveOverBtn = btnGroup.createEl("button", {
				cls: "mtt-icon-btn mtt-cta",
				attr: {
					"aria-label": label,
				},
			});
			setIcon(saveOverBtn, "save");
			setTooltip(saveOverBtn, label, {
				placement: "top",
				delay: 300,
			});
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
