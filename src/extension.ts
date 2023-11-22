/** @file Code Attractor extension for Visual Studio Code */
import * as vscode from 'vscode';
import * as lsp_client from 'vscode-languageclient';
import * as sidebar from './sidebar';
import * as editor from './editor';

/**
 * @function 拡張機能の有効化イベント
 * @param context extention contexest
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('"vscode-code-attractor" is now active!');
	const packageJson = vscode.extensions.getExtension('suzukimitsuru.code-attractor')?.packageJSON;
	const lsp = lsp_client.ReferencesRequest.method;

	// サイドバーの登録
	const tree = new sidebar.TreeProvider(new sidebar.TreeElement('root'));
	const sideview = vscode.window.createTreeView('codeattractor.sidebar', {treeDataProvider: tree});
	context.subscriptions.push(sideview);

	// エディタ(コマンド)の登録
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
			_editor = new editor.Attractor(panel, roots, tree);
		}
	});
	context.subscriptions.push(openEditor);
}

/**
 * @function 拡張機能の無効化イベント
 * @description VSCodeの終了/無効にする/アンインストール/
 */
export function deactivate() {
	console.log('"vscode-code-attractor" is now deactivate!');
}
