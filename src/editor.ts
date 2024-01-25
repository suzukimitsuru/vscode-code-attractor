import * as vscode from 'vscode';
import * as sidebar from './sidebar';
import * as SYMBOL from './symbol';

/** @class Code Attractor Editor */
export class Attractor {
	//#region 部品
		/** 表示パネル */
		private readonly _panel: vscode.WebviewPanel;
		/** WebルートURI */
		private readonly _roots: vscode.Uri;
		/** 関連リソース */
		private _disposables: vscode.Disposable[] = [];
	//#endregion

	//#region 値
		/** 選択した単語 */
		private _selected: string = 'Please select!';
		private _cametaStore: string  = '';
	//#endregion

	/** @constructor
	 * @param panel Webパネル
	 * @param roots	WebルートURI
	 * @param tree	木構造表示
	 */
	public constructor(panel: vscode.WebviewPanel, roots: vscode.Uri, tree: sidebar.TreeProvider) {
		console.log('"vscode-code-attractor" is create!');
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
		panel.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'redrawRequest':
					// 再描画
					panel.webview.postMessage({ command: "drawCanvas" });
					tree.root.addChild(new sidebar.TreeElement('redraw'));
					tree.refresh();
					break;
					case 'moveCamera':
						const position = JSON.parse(message.value);
						this._cametaStore = message.value;
						break;
				   case 'operation':
					console.log('operation: ' + message.value);
					break;
			}
		}, null, this._disposables);

		// エディタの選択変更イベント
		vscode.window.onDidChangeTextEditorSelection(async event => {
			const document = vscode.window.activeTextEditor?.document;
			const docSymbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document?.uri) as vscode.DocumentSymbol[];
			const symbolsToFind = Object.values(vscode.SymbolKind);
			const foundSymbols = docSymbols ? docSymbols.filter(symbol => symbolsToFind.includes(symbol.kind)) : undefined;
			panel.webview.postMessage({ command: "drawCanvas" });

			// シンボル階層を構築
			const fullname = document ? document.fileName : '';
			const folders = (vscode.workspace.workspaceFolders??[]).filter(folder => document?.fileName.includes(folder.name));
			const filename = folders.length > 0 ? fullname.replace(folders[0].uri.path, '') : fullname;
			const rootSymbol = new SYMBOL.Symbol(vscode.SymbolKind.File, filename, 0, document?.lineCount ? document.lineCount - 1 : 0);
			const sumSymbol = (found: vscode.DocumentSymbol, symbol: SYMBOL.Symbol) => {
				const branch = new SYMBOL.Symbol(found.kind, found.name, found.range.start.line, found.range.end.line);
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
			const sumTree = (symbol: SYMBOL.Symbol, element: sidebar.TreeElement | null): sidebar.TreeElement => {
				const branch = new sidebar.TreeElement(vscode.SymbolKind[symbol.kind] +': ' + symbol.name + '=' + symbol.lineCount);
				symbol.children.forEach(child => { sumTree(child, branch); });
				element?.addChild(branch);
				return branch;
			};
			const rootTree = sumTree(rootSymbol, null);
			tree.root.addChild(rootTree);
			tree.refresh();

			// ファイルを3Dで表示
			panel.webview.postMessage({ command: "showSymbol", value: rootSymbol });
			console.log('languageId: ' + vscode.window.activeTextEditor?.document.languageId??'');

			// 選択が有れば
			if (event.selections.length > 0) {
				// 全ての選択を
				event.selections.forEach(element => {
					// カーソルがある単語を抽出
					const doc = event.textEditor.document;
					const range = doc.getWordRangeAtPosition(element.start);
					this._selected = doc.getText(range);
					// 単語を表示
					tree.root.addChild(new sidebar.TreeElement('word: ' + this._selected));
					tree.refresh();
				});
			}
		});
	}

	/** @function 表示 */
	public reveal() {
		console.log('"vscode-code-attractor" is reveal!');
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
		console.log('"vscode-code-attractor" is now disposed!');
	}

	/** @function HTMLを返す */
	private _getHtml(webview: vscode.Webview, roots: vscode.Uri): string {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(roots, 'dist', 'bundle.js'));
		const stylesReset = webview.asWebviewUri(vscode.Uri.joinPath(roots, 'reset.css'));
		const stylesMain = webview.asWebviewUri(vscode.Uri.joinPath(roots, 'vscode.css'));
		const nonce = this._getNonce();
		return `<!DOCTYPE html>
			<html lang="jp">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} http: https: blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesReset}" rel="stylesheet">
				<link href="${stylesMain}" rel="stylesheet">
				<title>Code Attractor: Editor</title>
			</head>
			<body>
				<div>
					<button class="redraw-button">再描画</button>
					<div id="selected-word" class="stored-value">${this._selected}</div>
					<div id="camera-store" class="stored-value">${this._cametaStore}</div>
				</div>
				<div id="editor-base"><canvas id="editor-canvas"
					onPointerDown="handlePointerDown"
					onPointerMove="handlePointerMove"
					onPointerUp="handlePointerUp" /></div>
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
}
