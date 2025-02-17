/** @file Code Attractor Editor: Show Diagram */
import * as vscode from 'vscode';
import * as sidebar from './sidebar';
import * as SYMBOL from './symbol';
import * as path from 'path';

/** @class Code Attractor Editor */
export class Attractor {
	//#region 部品
		/** ログ出力 */
		private readonly _logs: vscode.OutputChannel;
		/** 表示パネル */
		private readonly _panel: vscode.WebviewPanel;
		/** WebルートURI */
		private readonly _roots: vscode.Uri;
		/** 関連リソース */
		private _disposables: vscode.Disposable[] = [];
	//#endregion

	//#region 値
		/** フルパスのファイル名 */
		private _fullName: string = '';
		/** シンボル木 */
		private _symbolTree: string = '';
		/** カメラ位置 */
		private _cametaStore: string  = '';
	//#endregion

	/** @constructor
	 * @param panel Webパネル
	 * @param roots	WebルートURI
	 * @param tree	木構造表示
	 */
	public constructor(logs: vscode.OutputChannel, panel: vscode.WebviewPanel, roots: vscode.Uri, tree: sidebar.TreeProvider) {
		this._logs = logs;
		this._logs.appendLine('"vscode-code-attractor" is create!');
		this._panel = panel;
		this._disposables.push(panel);
		this._roots = roots;

		// Webを表示
		panel.webview.html = this._getHtml(panel.webview, roots);

		// 廃棄イベント
		panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// 表示状態変更イベント
		panel.onDidChangeViewState(e => {
			// 表示していたら、更新
			if (panel.visible) {
				panel.webview.html = this._getHtml(panel.webview, roots);
			}
		}, null, this._disposables);

		// メッセージ受信イベント
		panel.webview.onDidReceiveMessage(async event => {
			switch (event.command) {
				case 'moveCamera':
					this._cametaStore = event.value;
					break;
				case 'saveSymbol':
					if (this._symbolTree !== event.value) {
						this._symbolTree = event.value;
					}
					break;
				case 'showFileAtLine':
					if (event.filename) {
						this._openFileAtLine(event.filename, event.lineNumber);
					}
					break;
				case 'operation':
					this._logs.appendLine('operation: ' + event.value);
					break;
				case 'debug':
					this._logs.appendLine('debug: ' + event.message);
					break;
				default:
					break;
			}
		}, null, this._disposables);

		// エディタの選択変更イベント
		vscode.window.onDidChangeTextEditorSelection(async event => {
			const document = vscode.window.activeTextEditor?.document;
			const documentUri = document ? document.uri : '';
			const fullname = document ? document.fileName : '';
			if (this._fullName !== fullname) {
				this._fullName = fullname;

				// 書類からシンボルを抽出
				const docSymbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', documentUri) as vscode.DocumentSymbol[];
				const symbolsToFind = Object.values(vscode.SymbolKind);
				const foundSymbols = docSymbols ? docSymbols.filter(symbol => symbolsToFind.includes(symbol.kind)) : undefined;

				// シンボル階層を構築
				const folders = (vscode.workspace.workspaceFolders??[]).filter(folder => document?.fileName.includes(folder.name));
				const filename = folders.length > 0 ? fullname.replace(folders[0].uri.path, '') : fullname;
				const rootSymbol = new SYMBOL.SymbolModel(vscode.SymbolKind.File, filename, fullname, 0, document?.lineCount ? document.lineCount - 1 : 0);
				const sumSymbol = (found: vscode.DocumentSymbol, symbol: SYMBOL.SymbolModel) => {
					const branch = new SYMBOL.SymbolModel(found.kind, found.name, fullname, found.range.start.line, found.range.end.line);
					found.children.forEach(child => { sumSymbol(child, branch); });
					symbol.addChild(branch);
				};
				foundSymbols?.forEach(found => { sumSymbol(found, rootSymbol); });

				// サイドバーの表示
				tree.root.children.forEach(child => { 
					tree.root.removeChild(child);
				});
				tree.root.children.forEach(child => { 
					tree.root.removeChild(child);
				});
				//const rootTree = new sidebar.TreeElement(vscode.SymbolKind[vscode.SymbolKind.File] +': ' + filename + '=' + document?.lineCount);
				const sumTree = (symbol: SYMBOL.SymbolModel, element: sidebar.TreeElement | null): sidebar.TreeElement => {
					const branch = new sidebar.TreeElement(vscode.SymbolKind[symbol.kind] +': ' + symbol.name + '=' + symbol.lineCount);
					symbol.children.forEach(child => { sumTree(child, branch); });
					element?.addChild(branch);
					return branch;
				};
				const rootTree = sumTree(rootSymbol, null);
				tree.root.addChild(rootTree);
				tree.refresh();

				// ファイルを3Dで表示
				this._symbolTree = JSON.stringify(rootSymbol);
				if (this._disposables.length > 0) {
					this.reveal();	// 再描画
					panel.webview.postMessage({ command: "showSymbolTree", value: this._symbolTree });
this._logs.appendLine(`onDidChangeTextEditorSelection(): ${rootSymbol.updateId}`);
				}
				this._logs.appendLine('languageId: ' + vscode.window.activeTextEditor?.document.languageId);

				// 選択が有れば
				if (event.selections.length > 0) {
					// 全ての選択を
					event.selections.forEach(element => {
						// カーソルがある単語を抽出
						const doc = event.textEditor.document;
						const range = doc.getWordRangeAtPosition(element.start);
						const selectedWord = doc.getText(range);
					});
				}
			}
		});
	}

	/** @function 表示 */
	public reveal() {
		this._logs.appendLine('"vscode-code-attractor" is reveal!');
		this._panel.reveal();
	}

	/** @function 破棄 */
	public dispose() {

		// 関連リソースを破棄
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
		this._logs.appendLine('"vscode-code-attractor" is now disposed!');
	}

	/** @function HTMLを返す */
	private _getHtml(webview: vscode.Webview, roots: vscode.Uri): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(roots, 'dist', 'bundle.js'));
		const stylesReset = webview.asWebviewUri(vscode.Uri.joinPath(roots, 'reset.css'));
		const stylesMain = webview.asWebviewUri(vscode.Uri.joinPath(roots, 'vscode.css'));
		const nonce = this._getNonce();
this._logs.appendLine(`_getHtml(): ${this._symbolTree ? JSON.parse(this._symbolTree).updateId : 'space!'}`);
		return `<!DOCTYPE html>
			<html lang="jp">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'self'; 
					img-src vscode-resource: ${webview.cspSource} http: https: blob:; 
					style-src vscode-resource: ${webview.cspSource}; 
					script-src vscode-resource: ${webview.cspSource} 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesReset}" rel="stylesheet">
				<link href="${stylesMain}" rel="stylesheet">
				<title>Code Attractor: Editor</title>
			</head>
			<body>
				<div>
					<button class="stored-value">再描画</button>
					<div id="symbol-tree" class="stored-value">${this._symbolTree}</div>
					<div id="camera-store" class="stored-value">${this._cametaStore}</div>
				</div>
				<div id="editor-base">
					<div id="editor-pointing-symbol-tooltip"></div>
					<canvas id="editor-canvas"
						onPointerDown="handlePointerDown"
						onPointerMove="handlePointerMove"
						onPointerUp="handlePointerUp" />
				</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

	/** @function 改修防止コード */
    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

	private _openFileAtLine(filePath: string, lineNumber: number) {

		// 書類を特定する
		const uri = vscode.Uri.file(path.resolve(filePath));
		vscode.workspace.openTextDocument(uri).then(document => {

			// 開いているエディタを探す
			const editor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === document.uri.toString());
			const options = editor ? { viewColumn: editor.viewColumn, preview: false } : { preview: false };
			vscode.window.showTextDocument(document, options).then(editor => {

				// 指定した行に移動する
				const position = new vscode.Position(lineNumber, 0);
				editor.selection = new vscode.Selection(position, position);
				editor.revealRange(new vscode.Range(position, position));
			});
		});
	}
}
