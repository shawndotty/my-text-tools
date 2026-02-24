import type { BatchProcess } from "../types";
import { BUILTIN_TOOLS } from "../types";

export interface CustomAIAction {
	id: string;
	name: string;
	icon?: string;
	showInRibbon: boolean;
	prompt: string;
	systemPrompt?: string;
	applyToSelection: boolean;
	overrideEnabled?: boolean;
	overrideProvider?: "deepseek" | "openai" | "custom";
	overrideApiKey?: string;
	overrideApiUrl?: string;
	overrideModel?: string;
	overrideMaxTokens?: number;
	overrideTemperature?: number;
}

export interface CustomScript {
	id: string;
	name: string;
	description?: string;
	icon?: string;
	showInRibbon: boolean;
	code: string;
	params?: ScriptParam[];
}

export type ScriptParamType =
	| "text"
	| "number"
	| "boolean"
	| "select"
	| "array";

export interface ScriptParam {
	key: string;
	label?: string;
	type: ScriptParamType;
	default?: string | number | boolean;
	options?: string[];
}

export interface AIToolConfig {
	prompt?: string;
	systemPrompt?: string;
	targetLanguage?: string;
}

export interface MyTextToolsSettings {
	mySetting: string;
	enabledTools: Record<string, boolean>;
	aiProvider: "deepseek" | "openai" | "custom";
	aiApiKey: string;
	aiApiUrl: string;
	aiModel: string;
	aiMaxTokens: number;
	aiTemperature: number;
	customActions: CustomAIAction[];
	customScripts: CustomScript[];
	aiTools: Record<string, AIToolConfig>;
	customIcons: Record<string, string>;
	savedBatches: BatchProcess[];
	batchShortcuts: Record<string, boolean>;
	regexExtractSeparator: string;
	prefix: string;
	suffix: string;
	wrapExcludeEmptyLines: boolean;
	filterText: string;
	filterMode: string;
	isToolsPanelCollapsed?: boolean;
	preserveFrontmatter: boolean;
	preserveHeader: boolean;
	updateSource: "github" | "gitee";
}

export const DEFAULT_SETTINGS: MyTextToolsSettings = {
	mySetting: "default",
	enabledTools: BUILTIN_TOOLS.reduce((acc, tool) => {
		acc[tool.id] = true;
		return acc;
	}, {} as Record<string, boolean>),
	aiProvider: "deepseek",
	aiApiKey: "",
	aiApiUrl: "https://api.deepseek.com/v1/chat/completions",
	aiModel: "deepseek-chat",
	aiMaxTokens: 2000,
	aiTemperature: 0.7,
	customActions: [],
	customScripts: [],
	aiTools: {},
	customIcons: {},
	savedBatches: [],
	batchShortcuts: {},
	regexExtractSeparator: "newline",
	prefix: "",
	suffix: "",
	wrapExcludeEmptyLines: false,
	filterText: "",
	filterMode: "containing",
	isToolsPanelCollapsed: false,
	preserveFrontmatter: true,
	preserveHeader: false,
	updateSource: "gitee",
};

