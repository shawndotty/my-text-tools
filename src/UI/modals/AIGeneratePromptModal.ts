import { App, Modal, Setting, Notice, ButtonComponent } from "obsidian";
import { t } from "../../lang/helpers";
import { AIService } from "../../utils/aiService";

interface PromptResult {
	systemPrompt: string;
	userPrompt: string;
}

export class AIGeneratePromptModal extends Modal {
	private aiService: AIService;
	private onGenerate: (result: PromptResult) => void;
	private requirement: string = "";

	constructor(
		app: App,
		aiService: AIService,
		onGenerate: (result: PromptResult) => void
	) {
		super(app);
		this.aiService = aiService;
		this.onGenerate = onGenerate;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(t("MODAL_GENERATE_PROMPT_TITLE"));

		// Requirement Input
		const reqContainer = contentEl.createDiv({ cls: "mtt-setting-row" });
		reqContainer.createEl("label", {
			text: t("MODAL_GENERATE_REQ_LABEL"),
			cls: "mtt-panel-title",
		});
		reqContainer.createEl("p", {
			text: t("MODAL_GENERATE_PROMPT_REQ_DESC"),
			cls: "setting-item-description",
		});

		const textArea = reqContainer.createEl("textarea", {
			cls: "mtt-textarea-small",
		});
		textArea.placeholder = t("MODAL_GENERATE_PROMPT_REQ_PLACEHOLDER");
		textArea.value = this.requirement;
		textArea.rows = 5;
		textArea.style.width = "100%";
		textArea.oninput = (e) => {
			this.requirement = (e.target as HTMLTextAreaElement).value;
		};

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
			const systemPrompt = `You are an expert prompt engineer for LLMs.
Your task is to create a professional System Prompt and User Prompt based on the user's requirement.
The user wants to create a text processing tool in Obsidian using AI.

You MUST return the output in valid JSON format with the following structure:
{
  "systemPrompt": "The professional system prompt...",
  "userPrompt": "The template for the user prompt..."
}

Rules for the prompts:
1. System Prompt: Should clearly define the AI's role, task, output format, and any constraints. It should be robust and handle edge cases.
2. User Prompt: This is the template that will optionally be combined with the selected text. It usually just describes the task simply or leaves room for the user to append text.
3. If the user's requirement implies a specific tone, style, or format, ensure the System Prompt enforces it.
4. Do NOT include markdown code blocks in the JSON output. Return RAW JSON only.`;

			const userMessage = `Requirement: ${this.requirement}
Generate the System Prompt and User Prompt JSON.`;

			const response = await this.aiService.processText(
				"",
				userMessage,
				systemPrompt
			);

			if (response.error) {
				new Notice(t("GENERATE_ERROR") + response.error);
			} else {
				let content = response.content.trim();
				// Clean up markdown code blocks if present
				content = content
					.replace(/^```json\n/i, "")
					.replace(/^```\n/i, "")
					.replace(/```$/, "");

				try {
					const result = JSON.parse(content) as PromptResult;
					if (result.systemPrompt && result.userPrompt !== undefined) {
						this.onGenerate(result);
						new Notice(t("GENERATE_SUCCESS"));
						this.close();
					} else {
						throw new Error("Invalid JSON structure");
					}
				} catch (e) {
					console.error("Failed to parse AI response:", content);
					new Notice(t("GENERATE_ERROR") + "Failed to parse JSON.");
				}
			}
		} catch (error) {
			new Notice(t("GENERATE_ERROR") + error);
		} finally {
			btn.setDisabled(false);
			btn.setButtonText(t("BTN_GENERATE"));
		}
	}
}
