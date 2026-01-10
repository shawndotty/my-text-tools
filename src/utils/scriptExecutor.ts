import { App, Notice } from "obsidian";

export class ScriptExecutor {
	constructor(private app: App) {}

	async execute(
		code: string,
		text: string,
		selection: string,
		params: Record<string, any> = {}
	): Promise<string> {
		return executeCustomScript(code, text, selection, params, this.app);
	}
}

/**
 * Executes a custom JavaScript script with the provided context.
 *
 * @param code The JavaScript code to execute.
 * @param text The full text of the file.
 * @param selection The currently selected text.
 * @param app The Obsidian App instance.
 * @returns The processed text or Promise<string>.
 */
export async function executeCustomScript(
	code: string,
	text: string,
	selection: string,
	params: Record<string, any>,
	app: App
): Promise<string> {
	try {
		// 创建一个异步函数构造器
		const AsyncFunction = Object.getPrototypeOf(
			async function () {}
		).constructor;

		// 构造函数体
		// 我们暴露 selection, app, text, console, Notice
		const func = new AsyncFunction(
			"selection",
			"text",
			"params",
			"app",
			"console",
			"Notice",
			`
            try {
                ${code}
            } catch (err) {
                throw err;
            }
            `
		);

		// 执行函数
		const result = await func(
			selection,
			text,
			params,
			app,
			console,
			Notice
		);

		// 如果结果是字符串，返回它
		if (typeof result === "string") {
			return result;
		}

		// 如果没有返回字符串，且没有报错，假设用户只是想执行副作用，返回原文本
		// 或者我们可以约定如果返回 null/undefined 则不修改文本
		if (result === undefined || result === null) {
			return selection;
		}

		return String(result);
	} catch (error: any) {
		console.error("Custom Script Error:", error);
		throw error;
	}
}
