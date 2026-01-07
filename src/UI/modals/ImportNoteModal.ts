import { App, FuzzySuggestModal, TFile } from "obsidian";
import { t } from "../../lang/helpers";

export class ImportNoteModal extends FuzzySuggestModal<TFile> {
	onChoose: (file: TFile, content: string) => void;

	constructor(app: App, onChoose: (file: TFile, content: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder(t("IMPORT_MODAL_PLACEHOLDER"));
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	async onChooseItem(
		item: TFile,
		evt: MouseEvent | KeyboardEvent
	): Promise<void> {
		const content = await this.app.vault.read(item);
		this.onChoose(item, content);
	}
}
