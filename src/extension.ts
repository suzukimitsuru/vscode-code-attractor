/**
 * Code Attractor extension for Visual Studio Code
 */
import * as vscode from 'vscode';

/**
 * Extention activater
 * @param context extention contexest
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('"vscode-code-attractor" is now active!');

	const provider = new SidebarViewProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, provider));
	
	// コマンドの登録
	let attractor: vscode.WebviewPanel | null = null;
	let disposable = vscode.commands.registerCommand('codeattractor.showEditor', () => {
		if (attractor == null) {
			attractor = vscode.window.createWebviewPanel("html","Code Attractor", 
				{viewColumn: vscode.ViewColumn.One, preserveFocus: true});
			attractor.onDidDispose(async () => { attractor = null; });
			const nonce ='';
			const scriptUri = attractor.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js'));
			const styleVSCodeUri = attractor.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'vscode.css'));
			const iconUrl = attractor.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'codeattractor-activity.svg'));
			//iconUrl.scheme = 'vscode-resource';
			attractor.webview.html = `<!DOCTYPE html>
			<html lang="jp">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${attractor.webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<title>Code Attractor: Editor</title>
			</head>
			<body>
				<img src="codeattractor-activity.svg" alt="Code Attructor icon" />
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
		}
	});

	context.subscriptions.push(disposable);
}

class SidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'codeattractor.views.sidebar';
	private _view?: vscode.WebviewView;
	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [ this._extensionUri ]
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
		webviewView.webview.onDidReceiveMessage(async data => {
			switch (data.type) {
				case 'showEditor': {
					vscode.commands.executeCommand('codeattractor.showEditor');
					vscode.window.setStatusBarMessage(data.value, 3000);
					break;
				}
			}
		});
	}
	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const nonce = getNonce();
		return `<!DOCTYPE html>
			<html lang="jp">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<title>Code Attractor: Sidebar</title>
			</head>
			<body>
				<button class="show-editor">表示</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}


// This method is called when your extension is deactivated
export function deactivate() {}
