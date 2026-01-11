import { IToolStrategy } from "./types";

export class ToolRegistry {
	private tools = new Map<string, IToolStrategy>();

	register(tool: IToolStrategy) {
		this.tools.set(tool.id, tool);
	}

	get(id: string): IToolStrategy | undefined {
		return this.tools.get(id);
	}

    getAll(): IToolStrategy[] {
        return Array.from(this.tools.values());
    }
}

export const toolRegistry = new ToolRegistry();
