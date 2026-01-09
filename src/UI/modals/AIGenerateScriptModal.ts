import { App, Modal, Setting, Notice, ButtonComponent } from "obsidian";
import { t } from "../../lang/helpers";
import { AIService } from "../../utils/aiService";

export class AIGenerateScriptModal extends Modal {
	private aiService: AIService;
	private onGenerate: (code: string) => void;
	private context: "selection" | "whole" = "selection";
	private requirement: string = "";

	constructor(
		app: App,
		aiService: AIService,
		onGenerate: (code: string) => void
	) {
		super(app);
		this.aiService = aiService;
		this.onGenerate = onGenerate;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(t("MODAL_GENERATE_SCRIPT_TITLE"));

		// Context Selection
		new Setting(contentEl)
			.setName(t("MODAL_GENERATE_CONTEXT_LABEL"))
			.addDropdown((dropdown) => {
				dropdown
					.addOption(
						"selection",
						t("MODAL_GENERATE_CONTEXT_SELECTION")
					)
					.addOption("whole", t("MODAL_GENERATE_CONTEXT_WHOLE"))
					.setValue(this.context)
					.onChange((value) => {
						this.context = value as "selection" | "whole";
					});
			});

		// Requirement Input
		new Setting(contentEl)
			.setName(t("MODAL_GENERATE_REQ_LABEL"))
			.addTextArea((text) => {
				text.setPlaceholder(
					t("MODAL_GENERATE_REQ_PLACEHOLDER")
				).setValue(this.requirement);
				text.inputEl.rows = 5;
				text.inputEl.style.width = "100%";
				text.onChange((value) => {
					this.requirement = value;
				});
			});

		// Generate Button
		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText(t("BTN_GENERATE"))
				.setCta()
				.onClick(async () => {
					await this.handleGenerate(btn);
				});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async handleGenerate(btn: ButtonComponent) {
		if (!this.requirement.trim()) {
			new Notice(t("MODAL_GENERATE_REQ_PLACEHOLDER"));
			return;
		}

		btn.setDisabled(true);
		btn.setButtonText(t("GENERATING_NOTICE"));

		try {
			const systemPrompt = `You are an expert JavaScript developer for Obsidian plugins.
Your task is to write a JavaScript code snippet based on the user's requirement.
The code will be used in a text processing tool.
Available variables:
- selection: The currently selected text (string).
- text: The entire text of the document (string).
- params: User-defined parameters (Record<string, any>), e.g., params.foo, params.count, params.enabled.
  - Types may be text, number, boolean, select, or array.
  - For array-type params, the input may come as a single newline-separated string; convert it to an array by splitting on /\\r?\\n/, trimming each item, and filtering out empty lines.
- app: The Obsidian App instance.
- console: The console object.
- Notice: The Obsidian Notice class.

You MUST return the new text to replace the ${
				this.context === "selection" ? "selection" : "whole text"
			}.
The code should be a valid JavaScript function body (you may use async/await).
Do not wrap the code in markdown code blocks. Just return the code.
Ensure the code handles edge cases gracefully.
If the user wants to process each line, split the text by newline, process, and join back.
If parameters are relevant, read them from 'params' and apply sensible defaults. When using array-type params, ensure you handle both pre-split arrays and newline strings by normalizing to string[] first.`;

			const fullUserPrompt = `Requirement: ${this.requirement}
Target: ${
				this.context === "selection"
					? "Replace Selection"
					: "Replace Whole Text"
			}
Generate the JavaScript code.`;

			const response = await this.aiService.processText(
				"",
				fullUserPrompt,
				systemPrompt
			);

			if (response.error) {
				new Notice(t("GENERATE_ERROR") + response.error);
			} else {
				let code = response.content.trim();
				// Remove markdown code blocks if present
				code = code
					.replace(/^```javascript\n/i, "")
					.replace(/^```js\n/i, "")
					.replace(/^```\n/i, "")
					.replace(/```$/, "");

				this.onGenerate(code);
				new Notice(t("GENERATE_SUCCESS"));
				this.close();
			}
		} catch (error) {
			new Notice(t("GENERATE_ERROR") + error);
		} finally {
			btn.setDisabled(false);
			btn.setButtonText(t("BTN_GENERATE"));
		}
	}
}
