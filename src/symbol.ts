import * as vscode from 'vscode';

export class Symbol {
    public readonly kind: vscode.SymbolKind;
    public readonly name: string;
    public readonly startLine: number;
    public readonly endLine: number;
    public readonly lineCount: number;
    public children: Symbol[] = [];
	public constructor(kind: vscode.SymbolKind, name: string, startLine: number, endLine: number) {
        this.kind = kind;
        this.name = name;
        this.startLine = startLine;
        this.endLine = endLine;
        this.lineCount = endLine - startLine + 1;
    }
    public addChild(child: Symbol) {
        this.children.push(child);
    }
}
