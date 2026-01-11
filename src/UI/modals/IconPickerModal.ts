import { App, Modal, setIcon, TextComponent, getIconIds } from "obsidian";
import { t } from "../../lang/helpers";

export class IconPickerModal extends Modal {
	onSelect: (icon: string) => void;
	searchQuery: string = "";
	iconGrid: HTMLElement;

	constructor(app: App, onSelect: (icon: string) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(t("MODAL_ICON_PICKER_TITLE"));

		const searchContainer = contentEl.createDiv();
		const searchInput = new TextComponent(searchContainer);
		searchInput.setPlaceholder(t("MODAL_ICON_PICKER_SEARCH_PLACEHOLDER"));
		searchInput.inputEl.style.width = "100%";
		searchInput.onChange((value) => {
			this.searchQuery = value.toLowerCase();
			this.renderIcons();
		});
		searchInput.inputEl.focus();

		this.iconGrid = contentEl.createDiv({ cls: "mtt-icon-grid" });
		this.iconGrid.style.display = "grid";
		this.iconGrid.style.gridTemplateColumns =
			"repeat(auto-fill, minmax(40px, 1fr))";
		this.iconGrid.style.gap = "8px";
		this.iconGrid.style.marginTop = "16px";
		this.iconGrid.style.maxHeight = "400px";
		this.iconGrid.style.overflowY = "auto";

		this.renderIcons();
	}

	renderIcons() {
		this.iconGrid.empty();
		const icons = getIconIds();

		icons.forEach((icon) => {
			if (
				this.searchQuery &&
				!icon.toLowerCase().includes(this.searchQuery)
			) {
				return;
			}

			const iconItem = this.iconGrid.createDiv({ cls: "mtt-icon-item" });
			iconItem.style.display = "flex";
			iconItem.style.alignItems = "center";
			iconItem.style.justifyContent = "center";
			iconItem.style.padding = "8px";
			iconItem.style.cursor = "pointer";
			iconItem.style.borderRadius = "4px";
			iconItem.style.border =
				"1px solid var(--background-modifier-border)";

			setIcon(iconItem, icon);

			iconItem.setAttribute("aria-label", icon);

			iconItem.onclick = () => {
				this.onSelect(icon);
				this.close();
			};

			iconItem.onmouseenter = () =>
				(iconItem.style.backgroundColor =
					"var(--background-secondary)");
			iconItem.onmouseleave = () => (iconItem.style.backgroundColor = "");
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
