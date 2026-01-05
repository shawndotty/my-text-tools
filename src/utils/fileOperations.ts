import { App, TFile, normalizePath, Notice } from "obsidian";
import { t } from "../lang/helpers";

/**
 * 保存内容到原编辑器
 */
export function saveToOriginal(
	content: string,
	originalEditor: any
): boolean {
	if (originalEditor) {
		originalEditor.setValue(content);
		new Notice(t("NOTICE_SAVE_SUCCESS"));
		return true;
	} else {
		new Notice(t("NOTICE_SAVE_ERROR"));
		return false;
	}
}

/**
 * 保存内容为新文件
 */
export async function saveToNewFile(
	app: App,
	content: string
): Promise<void> {
	const activeFile = app.workspace.getActiveFile();

	// 1. 确定基础路径和文件名
	// 如果没有打开的笔记，则定位到根目录，文件名为 "未命名"
	const folderPath = activeFile?.parent ? activeFile.parent.path : "/";
	const baseName = activeFile
		? activeFile.basename
		: t("DEFAULT_FILENAME");
	const extension = activeFile ? activeFile.extension : "md";

	let newFileName = "";
	let counter = 1;
	let fileExists = true;

	while (fileExists) {
		newFileName = normalizePath(
			`${folderPath}/${baseName}_${counter}.${extension}`
		);
		const abstractFile = app.vault.getAbstractFileByPath(newFileName);
		if (!abstractFile) {
			fileExists = false;
		} else {
			counter++;
		}
	}

	try {
		// 2. 创建新文件
		const newFile = await app.vault.create(newFileName, content);
		new Notice(t("NOTICE_COPY_CREATED", [`${baseName}_${counter}`]));

		// 3. 在新标签页中打开这个文件
		if (newFile instanceof TFile) {
			const leaf = app.workspace.getLeaf("tab"); // 'tab' 表示在新标签页打开
			await leaf.openFile(newFile);

			// 可选：打开后将焦点切回新笔记
			app.workspace.setActiveLeaf(leaf, { focus: true });
		}
	} catch (error) {
		console.error(error);
		new Notice(t("NOTICE_COPY_ERROR"));
	}
}

