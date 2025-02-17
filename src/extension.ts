/** @file Code Attractor extension for Visual Studio Code */
import * as vscode from 'vscode';
//import * as lsp_client from 'vscode-languageclient';
import * as status from './status'
import * as sidebar from './sidebar';
import * as editor from './editor';
import * as codefiles from './codeFiles';
import { resolve } from 'path';

const packageJson = vscode.extensions.getExtension('suzukimitsrugunmajapan.code-attractor')?.packageJSON;
const logs = vscode.window.createOutputChannel(packageJson.displayName, { log: true});
const statusbar = new status.StatusBar(packageJson.displayName, 'codeattractor.openEditor');

/**
 * @function 拡張機能の有効化イベント
 * @param context extention contexest
 */
export function activate(context: vscode.ExtensionContext) {
	logs.appendLine('"vscode-code-attractor" is now active!');
//	const lsp = lsp_client.ReferencesRequest.method;

	// サイドバーの登録
	const tree = new sidebar.TreeProvider(new sidebar.TreeElement('root'));
	const sideview = vscode.window.createTreeView('codeattractor.sidebar', {treeDataProvider: tree});
	context.subscriptions.push(sideview);

	// 経過表示
	const files = new codefiles.CodeFiles(vscode.workspace.workspaceFolders??[], 
		['plaintext', 'markdown', 'shellscript', 
		'json', 'jsonc', 'xml', 'yaml', 'csv', 'log', 'ini', 'html', 'css', 'svg']);
	statusbar.maintainSymbols(files);

	// ログ出力ビューコマンドの登録
	const logsCommand = vscode.commands.registerCommand('codeattractor.showLogs', () => {
		// 出力ビューを表示
		logs.show(true);
	});
	context.subscriptions.push(logsCommand);

	// エディタを開くコマンドの登録
	let _editor: editor.Attractor | null = null;
	const openEditor = vscode.commands.registerCommand('codeattractor.openEditor', () => {

		// エディタが在ったら
		if (_editor) {

			// エディタの表示
			_editor.reveal();
		} else {
			// エディタの生成
			const roots = vscode.Uri.joinPath(context.extensionUri, 'media');
			const column = vscode.window.activeTextEditor
				? Number(vscode.window.activeTextEditor.viewColumn) + 1
				: vscode.ViewColumn.Two;
			const panel = vscode.window.createWebviewPanel('codeattractor.editor', 'Code Attractor', 
				column, {enableScripts: true, localResourceRoots: [roots] });
			panel.iconPath = vscode.Uri.joinPath(roots, 'codeattractor-icon.svg');
			panel.onDidDispose(() => _editor = null);
			_editor = new editor.Attractor(logs, panel, roots, tree);
		}
	});
	context.subscriptions.push(openEditor);
}

/**
 * @function 拡張機能の無効化イベント
 * @description VSCodeの終了/無効にする/アンインストール/
 */
export function deactivate() {
	logs.appendLine('"vscode-code-attractor" is now deactivate!');
}
