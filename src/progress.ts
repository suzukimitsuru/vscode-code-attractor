/** @file Code Attractor: Progress interface */
import * as vscode from 'vscode';

/** 経過インターファース */
export abstract class IProgress {
    public abstract Progress(progress: vscode.Progress<{ message?: string; increment?: number; }>, 
        token: vscode.CancellationToken): Promise<void>;
}
