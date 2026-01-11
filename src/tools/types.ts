import { SettingsState } from "../types";

export interface ToolExecutionOptions {
	hideNotice?: boolean;
}

export interface IToolStrategy {
	id: string;
	execute(
		text: string,
		settings: SettingsState,
		options?: ToolExecutionOptions
	): Promise<string> | string;
}
