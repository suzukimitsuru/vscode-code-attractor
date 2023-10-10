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
	let disposable = vscode.commands.registerCommand('codeattractor.showEditor', () => {
		const icon_path = vscode.Uri.joinPath(context.extensionUri, 'media', 'codeattractor-icon.svg');
		AttractorEditor.createOrShow(context.extensionUri, icon_path);
	});

	context.subscriptions.push(disposable);
}

/**
Sidebar webview provider
 */
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
				case 'addCounter': {
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
		const iconUrl = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'codeattractor-icon.svg'));
		const nonce = getNonce();
		return `<!DOCTYPE html>
			<html lang="jp">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: https:; ">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<title>Code Attractor: Sidebar</title>
			</head>
			<body>
			<img src="${iconUrl}" alt="Code Attructor icon">
			<button class="show-editor">表示</button>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

/**
Manages cat coding webview panels
 */
class AttractorEditor {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: AttractorEditor | undefined;
	public static readonly viewType = 'codeattractor.views.editor';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _counter: number = 0;

	public static createOrShow(extensionUri: vscode.Uri, iconUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (AttractorEditor.currentPanel) {
			AttractorEditor.currentPanel._panel.reveal(column);
		} else {
			// Otherwise, create a new panel.
			const panel = vscode.window.createWebviewPanel(AttractorEditor.viewType, 'Code Attractor', 
				column || vscode.ViewColumn.One, getWebviewOptions(extensionUri));
			panel.iconPath = iconUri;
			AttractorEditor.currentPanel = new AttractorEditor(panel, extensionUri);
		}
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		AttractorEditor.currentPanel = new AttractorEditor(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(async message => {
				switch (message.type) {
					case 'addCounter':
						this._counter += message.value;
						this._update();
						break;
				}
			}, null, this._disposables
		);
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		AttractorEditor.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		this._panel.title = 'Code Attructor';
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="jp">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: https:; ">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
				<title>Code Attractor: Sidebar</title>
			</head>
			<body>
				<button class="show-editor">＋２</button>
				<li>${this._counter}</li>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `media` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
	};
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
