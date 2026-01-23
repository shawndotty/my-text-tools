import {
	EditorView,
	Decoration,
	DecorationSet,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";

export const setRegexPattern = StateEffect.define<{
	pattern: string;
	flags: string;
} | null>();

export const currentRegexField = StateField.define<{
	pattern: string;
	flags: string;
} | null>({
	create: () => null,
	update(value, tr) {
		for (let e of tr.effects) if (e.is(setRegexPattern)) value = e.value;
		return value;
	},
});

const highlightMark = Decoration.mark({ class: "mtt-regex-match" });

export const regexHighlightPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.computeDecorations(view);
		}

		update(update: ViewUpdate) {
			const regexChanged =
				update.startState.field(currentRegexField) !==
				update.state.field(currentRegexField);
			if (update.docChanged || regexChanged) {
				this.decorations = this.computeDecorations(update.view);
			}
		}

		computeDecorations(view: EditorView): DecorationSet {
			const regexConfig = view.state.field(currentRegexField);
			if (!regexConfig || !regexConfig.pattern) return Decoration.none;

			const builder = new RangeSetBuilder<Decoration>();
			try {
				// Ensure global flag is present to avoid infinite loop
				const flags = regexConfig.flags.includes("g")
					? regexConfig.flags
					: regexConfig.flags + "g";
				const regex = new RegExp(regexConfig.pattern, flags);
				const text = view.state.doc.toString();

				let match;
				while ((match = regex.exec(text)) !== null) {
					// Prevent infinite loop with zero-length matches
					if (match.index === regex.lastIndex) {
						regex.lastIndex++;
					}

					const start = match.index;
					const end = start + match[0].length;

					if (start < end) {
						builder.add(start, end, highlightMark);
					}
				}
			} catch (_e) {
				// Invalid regex, ignore
			}
			return builder.finish();
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

export const highlightTheme = EditorView.baseTheme({
	".mtt-regex-match": {
		backgroundColor: "var(--text-selection)", // Use selection color or highlight color
		borderRadius: "2px",
		outline: "1px solid var(--interactive-accent)",
	},
});
