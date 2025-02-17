/** @file Code Attractor: Status bar */
import * as vscode from 'vscode';
import * as progress from './progress';

/** @class Status bar */
export class StatusBar {
    private readonly _name: string;
    private readonly _item: vscode.StatusBarItem;
    constructor(name: string, command: string) {
        this._name = name;

        // 引力図を開くボタン
		this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
		this._item.text = `$(gear~spin)${this._name}`;
		this._item.command = command;
		this._item.tooltip = `Open ${this._name}`;
    }

    /**
     * @function 経過表示
     * @param shortName 短い名前
     * @param displayName 表示名
     * @param max 最大数
     */
    public maintainSymbols(task: progress.IProgress): void {
        vscode.window.withProgress(
            { location: vscode.ProgressLocation.Window, title: this._name, cancellable: true },
            async (progress, token) => {
                this._item.hide();

                token.onCancellationRequested(() => {
                    console.log("User canceled the task.");
                });
          
                await task.Progress(progress, token);

                if (! token.isCancellationRequested) {
                    this._item.show();
                }
            } 
        );
    }
}