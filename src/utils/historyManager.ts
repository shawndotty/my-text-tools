/**
 * 历史记录管理器
 * 负责管理撤销/重做功能
 */
export class HistoryManager {
	private history: string[] = [];
	private redoHistory: string[] = [];
	private maxHistorySize: number = 50;

	/**
	 * 将当前内容推入历史记录
	 */
	pushToHistory(content: string): void {
		// 如果当前内容和历史最后一次记录不同，才存入
		if (
			this.history.length === 0 ||
			this.history[this.history.length - 1] !== content
		) {
			this.history.push(content);
			// 超过最大步数时删除最早的记录
			if (this.history.length > this.maxHistorySize) {
				this.history.shift();
			}
		}
		// 执行了新操作，必须清空重做栈
		this.redoHistory = [];
	}

	/**
	 * 撤销操作
	 * @returns 撤销后的内容，如果无法撤销则返回 null
	 */
	undo(currentContent: string): string | null {
		if (this.history.length > 0) {
			// 将当前内容存入重做栈
			this.redoHistory.push(currentContent);
			const previousContent = this.history.pop();
			if (previousContent !== undefined) {
				return previousContent;
			}
		}
		return null;
	}

	/**
	 * 重做操作
	 * @returns 重做后的内容，如果无法重做则返回 null
	 */
	redo(currentContent: string): string | null {
		if (this.redoHistory.length > 0) {
			// 将当前内容存回撤销栈
			this.history.push(currentContent);

			const next = this.redoHistory.pop();
			if (next !== undefined) {
				return next;
			}
		}
		return null;
	}

	/**
	 * 检查是否可以撤销
	 */
	canUndo(): boolean {
		return this.history.length > 0;
	}

	/**
	 * 检查是否可以重做
	 */
	canRedo(): boolean {
		return this.redoHistory.length > 0;
	}

	/**
	 * 清空历史记录
	 */
	clear(): void {
		this.history = [];
		this.redoHistory = [];
	}
}
