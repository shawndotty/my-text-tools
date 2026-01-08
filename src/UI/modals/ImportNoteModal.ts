import {
	App,
	SuggestModal,
	TFile,
	HeadingCache,
	prepareFuzzySearch,
	SearchResult,
	renderMatches,
} from "obsidian";
import { t } from "../../lang/helpers";

interface ImportItem {
	file: TFile;
	heading?: HeadingCache;
	block?: {
		content: string;
		startLine: number;
		endLine: number;
	};
	match?: SearchResult;
}

export class ImportNoteModal extends SuggestModal<ImportItem> {
	onChoose: (file: TFile, content: string) => void;

	constructor(app: App, onChoose: (file: TFile, content: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder(t("IMPORT_MODAL_PLACEHOLDER"));
	}

	onOpen() {
		super.onOpen();
		this.inputEl.addEventListener("input", (e: Event) => {
			const val = this.inputEl.value;
			// If user types # and it's the first #
			if (val.endsWith("#") && (val.match(/#/g) || []).length === 1) {
				this.tryAutofillCurrentFile("#");
			}
			// If user types ^ and it's the first ^
			if (val.endsWith("^") && (val.match(/\^/g) || []).length === 1) {
				this.tryAutofillCurrentFile("^");
			}
		});
	}

	tryAutofillCurrentFile(triggerChar: string) {
		const chooser = (this as any).chooser;
		if (
			chooser &&
			chooser.values &&
			typeof chooser.selectedItem === "number"
		) {
			const selectedIndex = chooser.selectedItem;
			if (selectedIndex >= 0 && selectedIndex < chooser.values.length) {
				const item = chooser.values[selectedIndex] as ImportItem;
				if (item && item.file && !item.heading && !item.block) {
					// Autofill with file path (without extension) + triggerChar
					this.inputEl.value =
						item.file.path.replace(/\.md$/, "") + triggerChar;
					// Dispatch input event to trigger suggestion update
					this.inputEl.dispatchEvent(new Event("input"));
				}
			}
		}
	}

	async getSuggestions(query: string): Promise<ImportItem[]> {
		const hashIndex = query.lastIndexOf("#");
		const caretIndex = query.lastIndexOf("^");

		// Priority: Check which separator comes last
		if (caretIndex >= 0 && caretIndex > hashIndex) {
			// Block search mode
			const filePathPart = query.substring(0, caretIndex);
			const blockPart = query.substring(caretIndex + 1);

			if (!filePathPart) return [];

			const bestFile = this.findBestFile(filePathPart);

			if (bestFile) {
				const metadata = this.app.metadataCache.getFileCache(bestFile);
				if (!metadata || !metadata.sections) return [];

				// We need to read the file content to search blocks
				const content = await this.app.vault.read(bestFile);
				const lines = content.split("\n");

				const blockSearch = prepareFuzzySearch(blockPart);
				const items: ImportItem[] = [];

				for (const section of metadata.sections) {
					const startLine = section.position.start.line;
					const endLine = section.position.end.line;
					const sectionContent = lines
						.slice(startLine, endLine + 1)
						.join("\n");

					// Skip empty blocks
					if (!sectionContent.trim()) continue;

					const result = blockSearch(sectionContent);
					if (result) {
						items.push({
							file: bestFile!,
							block: {
								content: sectionContent,
								startLine,
								endLine,
							},
							match: result,
						});
					}
				}

				return items.sort(
					(a, b) => (b.match?.score || 0) - (a.match?.score || 0)
				);
			}
			return [];
		} else if (hashIndex >= 0) {
			const filePathPart = query.substring(0, hashIndex);
			const headerPart = query.substring(hashIndex + 1);

			if (!filePathPart) return [];

			const bestFile = this.findBestFile(filePathPart);

			if (bestFile) {
				const metadata = this.app.metadataCache.getFileCache(bestFile);
				if (!metadata || !metadata.headings) return [];

				const headingSearch = prepareFuzzySearch(headerPart);
				const items: ImportItem[] = [];

				for (const heading of metadata.headings) {
					const result = headingSearch(heading.heading);
					if (result) {
						items.push({
							file: bestFile!,
							heading: heading,
							match: result,
						});
					}
				}

				return items.sort(
					(a, b) => (b.match?.score || 0) - (a.match?.score || 0)
				);
			}
			return [];
		} else {
			const files = this.app.vault.getMarkdownFiles();
			const search = prepareFuzzySearch(query);
			const items: ImportItem[] = [];

			for (const file of files) {
				const result = search(file.path);
				if (result) {
					items.push({
						file: file,
						match: result,
					});
				}
			}

			return items.sort(
				(a, b) => (b.match?.score || 0) - (a.match?.score || 0)
			);
		}
	}

	findBestFile(query: string): TFile | null {
		const files = this.app.vault.getMarkdownFiles();
		const search = prepareFuzzySearch(query);

		let bestFile: TFile | null = null;
		let bestScore = -Infinity;

		for (const file of files) {
			const pathNoExt = file.path.replace(/\.md$/, "");
			// Exact match priority
			if (pathNoExt === query || file.path === query) {
				return file;
			}

			const result = search(file.path);
			if (result && result.score > bestScore) {
				bestScore = result.score;
				bestFile = file;
			}
		}
		return bestFile;
	}

	renderSuggestion(item: ImportItem, el: HTMLElement) {
		el.addClass("mod-complex");
		const content = el.createDiv({ cls: "suggestion-content" });
		const title = content.createDiv({ cls: "suggestion-title" });

		if (item.heading) {
			// Header
			if (item.match) {
				renderMatches(title, item.heading.heading, item.match.matches);
			} else {
				title.setText(item.heading.heading);
			}

			const note = content.createDiv({ cls: "suggestion-note" });
			note.setText(item.file.path);
		} else if (item.block) {
			// Block
			// Use clean content for rendering (replace newlines with spaces)
			// to preserve match indices (since \n is 1 char and space is 1 char)
			const cleanContent = item.block.content.replace(/\n/g, " ");

			if (item.match) {
				renderMatches(title, cleanContent, item.match.matches);
			} else {
				title.setText(cleanContent);
			}

			const note = content.createDiv({ cls: "suggestion-note" });
			note.setText(item.file.path);
		} else {
			// File
			// Optional: Show modification date or size in note?
			// const note = content.createDiv({ cls: "suggestion-note" });

			if (item.match) {
				renderMatches(title, item.file.path, item.match.matches);
			} else {
				title.setText(item.file.path);
			}
		}
	}

	async onChooseSuggestion(
		item: ImportItem,
		evt: MouseEvent | KeyboardEvent
	) {
		let content = "";
		if (item.block) {
			content = item.block.content;
		} else if (item.heading) {
			// Extract section
			const fileContent = await this.app.vault.read(item.file);
			const metadata = this.app.metadataCache.getFileCache(item.file);
			if (metadata && metadata.headings) {
				const startLine = item.heading.position.start.line;
				let endLine = -1;

				// Find the next heading of same or higher level
				const index = metadata.headings.indexOf(item.heading);
				for (let i = index + 1; i < metadata.headings.length; i++) {
					const h = metadata.headings[i];
					if (h && h.level <= item.heading.level) {
						endLine = h.position.start.line - 1;
						break;
					}
				}

				const lines = fileContent.split("\n");
				if (endLine === -1) {
					// Until end of file
					content = lines.slice(startLine).join("\n");
				} else {
					content = lines.slice(startLine, endLine + 1).join("\n");
				}
			}
		} else {
			content = await this.app.vault.read(item.file);
		}

		this.onChoose(item.file, content);
	}
}
