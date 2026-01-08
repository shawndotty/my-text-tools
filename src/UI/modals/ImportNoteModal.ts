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
				const chooser = (this as any).chooser;
				if (
					chooser &&
					chooser.values &&
					typeof chooser.selectedItem === "number"
				) {
					const selectedIndex = chooser.selectedItem;
					if (
						selectedIndex >= 0 &&
						selectedIndex < chooser.values.length
					) {
						const item = chooser.values[
							selectedIndex
						] as ImportItem;
						if (item && item.file && !item.heading) {
							// Autofill with file path (without extension) + #
							// We prevent triggering this again by checking if # is already present
							this.inputEl.value =
								item.file.path.replace(/\.md$/, "") + "#";
							// Dispatch input event to trigger suggestion update
							this.inputEl.dispatchEvent(new Event("input"));
						}
					}
				}
			}
		});
	}

	async getSuggestions(query: string): Promise<ImportItem[]> {
		const hashIndex = query.lastIndexOf("#");

		if (hashIndex >= 0) {
			const filePathPart = query.substring(0, hashIndex);
			const headerPart = query.substring(hashIndex + 1);

			if (!filePathPart) return [];

			const files = this.app.vault.getMarkdownFiles();
			const search = prepareFuzzySearch(filePathPart);

			let bestFile: TFile | null = null;
			let bestScore = -Infinity;

			// Find best matching file
			for (const file of files) {
				const pathNoExt = file.path.replace(/\.md$/, "");
				// Exact match priority
				if (pathNoExt === filePathPart || file.path === filePathPart) {
					bestFile = file;
					bestScore = Infinity;
					break;
				}

				const result = search(file.path);
				if (result && result.score > bestScore) {
					bestScore = result.score;
					bestFile = file;
				}
			}

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

	renderSuggestion(item: ImportItem, el: HTMLElement) {
		el.addClass("mod-complex");
		const content = el.createDiv({ cls: "suggestion-content" });
		const title = content.createDiv({ cls: "suggestion-title" });

		if (item.heading) {
			// Header
			title.setText(item.heading.heading);
			const note = content.createDiv({ cls: "suggestion-note" });
			note.setText(item.file.path);

			if (item.match) {
				renderMatches(title, item.heading.heading, item.match.matches);
			}
		} else {
			// File
			title.setText(item.file.path);
			// Optional: Show modification date or size in note?
			// const note = content.createDiv({ cls: "suggestion-note" });

			if (item.match) {
				renderMatches(title, item.file.path, item.match.matches);
			}
		}
	}

	async onChooseSuggestion(
		item: ImportItem,
		evt: MouseEvent | KeyboardEvent
	) {
		let content = await this.app.vault.read(item.file);

		if (item.heading) {
			// Extract section
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

				const lines = content.split("\n");
				if (endLine === -1) {
					// Until end of file
					content = lines.slice(startLine).join("\n");
				} else {
					content = lines.slice(startLine, endLine + 1).join("\n");
				}
			}
		}

		this.onChoose(item.file, content);
	}
}
