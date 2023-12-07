import * as vscode from 'vscode';
import * as sidebar from './sidebar';

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
		/** カウンタ */
		private _counter: number = 0;
		/** 選択した単語 */
		private _selected: string = 'Please select!';
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
				case 'countUp':
					// カウントアップして表示
					this._counter += message.value;
					panel.webview.postMessage({ command: "showCounter", value: this._counter });
					tree.root.addChild(new sidebar.TreeElement('counter: ' + this._counter));
					tree.refresh();
					break;
			}
		}, null, this._disposables);

		// エディタの選択変更イベント
		vscode.window.onDidChangeTextEditorSelection(async event =>{
			const docSymbols = await vscode.commands.executeCommand(
				'vscode.executeDocumentSymbolProvider',
				vscode.window.activeTextEditor?.document.uri
			) as vscode.DocumentSymbol[];
			const symbolsToFind = [vscode.SymbolKind.Class, vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Constructor];
			const filtedSymbols = docSymbols
				? docSymbols.filter(symbol => symbolsToFind.includes(symbol.kind))
				: undefined;
			let words: string[] = [];
			filtedSymbols?.forEach(element => {
				// 関数を表示
				words.push(element.name);
				tree.root.addChild(new sidebar.TreeElement('function: ' + element.name));
				tree.refresh();
			});
			console.log('languageId: ' + vscode.window.activeTextEditor?.document.languageId??'');
			//panel.webview.postMessage({ command: "showWord", value: words as any });

			// 選択が有れば
			if (event.selections.length > 0) {
				// 全ての選択を
				event.selections.forEach(element => {
					// カーソルがある単語を抽出
					const doc = event.textEditor.document;
					const range = doc.getWordRangeAtPosition(element.start);
					this._selected = doc.getText(range);
					// 単語を表示
					panel.webview.postMessage({ command: "showWord", value: this._selected });
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
				<button class="two-button">＋２</button>
				<div id="counter-value">${this._counter}</div>
				<br/>
				<label>Selected</label>
				<div id="selected-word">${this._selected}</div>
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
