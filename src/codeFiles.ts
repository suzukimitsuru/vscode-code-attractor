/** @file Code Attractor: Code files */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as progress from './progress';
import * as SYMBOL from './symbol';

class WorkspaceFolder {
    public constructor(public readonly name: string, public readonly path: string) {}
}
class WorkspaceFolders {
    private _items: WorkspaceFolder[] = [];
    public constructor() {}
    public length(): number { return this._items.length; }
    public item(index: number): WorkspaceFolder { return this._items[index]; }
    public push(folder: WorkspaceFolder) {
        this._items.push(folder);
    }
    public find(predicate: (value: WorkspaceFolder, index: number, array: WorkspaceFolder[]) => boolean): WorkspaceFolder {
        const items = this._items.filter(predicate);
        return items.reduce((longest, current) => (current.path.length > longest.path.length ? current : longest), new WorkspaceFolder("", ""));
    }
}
class CodeDocument {
    constructor(public readonly document: vscode.TextDocument, public readonly shortName: string) {}
}

/** @class Code files */
export class CodeFiles extends progress.IProgress {
    private readonly _folders = new WorkspaceFolders();
    private readonly _excludeId: string[];
    private _documents: Promise<CodeDocument>[];

    constructor(folders: readonly vscode.WorkspaceFolder[], excludeId: string[]) {
        super();
        for (const folder of folders) {
            this._folders.push( new WorkspaceFolder(folder.name, folder.uri.path));
        }
        this._excludeId = excludeId;
        this._documents = [];
    }

    public async Progress(progress: vscode.Progress<{ message?: string; increment?: number; }>, 
        token: vscode.CancellationToken): Promise<void> {

        // 経過の初期化
        this._documents = [];
        progress.report({ increment: 0 });
        const start = performance.now();

        // フォルダ一覧を検索
        let folder_index = 0;
        let folder_name: string | null = null;
        let file_index = -1;
        let files: string[] = [];
        while (folder_index < this._folders.length()) {

            // 中断
            if (token.isCancellationRequested) { break; }
            //await new Promise((resolve) => setTimeout(resolve, 500));

            // 次のフォルダ
            if (folder_name === null) {
                folder_name = this._folders.item(folder_index).path;
                file_index = 0;
                files = await this._listFiles(folder_name);
            }

            // 書類がコードで
            const file_name = files[file_index];
            const short_name = file_name.substring(folder_name.length + 1);
            const text_doc = await this._loadDocument(file_name);
            if (text_doc) {
                // 除外ファイルでは無かったら
                if (! this._excludeId.includes(text_doc.languageId)) {
                    // コード書類に追加する
                    this._documents.push(new Promise(async (resolve, reject) => {
                        try {
                            // 書類からシンボルを抽出
                            const doc_promise = vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', text_doc.uri).then( (value) => {
                                const parent = this._folders.find(folder => text_doc.fileName.includes(folder.name));
                                const registered_kindes = Object.values(vscode.SymbolKind);
                                const registered_symbols = (value as vscode.DocumentSymbol[]).filter(symbol => registered_kindes.includes(symbol.kind));
                                this.task2(parent, text_doc, registered_symbols).then((codeDoc) => resolve(codeDoc));
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }) );
                }
            }

            // 次のファイル
            file_index++;
            if (file_index >= files.length) {
                folder_name = null;
                folder_index++;
            }

            // 経過表示
            progress.report({ increment: 1, message: ` ${short_name}` });
        }
        const result = await Promise.all(this._documents);

        const end = performance.now();
        console.log(`${result.length}: ${(end - start).toFixed(3)} ms`);
    }
    // thenでtask2を呼び出す時に、第一引数をbindで固定しているため、値の受け取りは以下になる
    // 第1引数 args  => ['aaa','bbb']
    // 第2引数 value => ['task1 完了!', '123']
    private task2(parent: WorkspaceFolder, textDoc: vscode.TextDocument, symbols: vscode.DocumentSymbol[]): Promise<CodeDocument>{
        return new Promise(function (resolve, reject) {
            const file_name = textDoc.uri.path;
            const short_name = file_name.substring(parent.path.length + 1);

            // シンボル階層を構築
            const root_symbol = new SYMBOL.SymbolModel(vscode.SymbolKind.File, short_name, file_name, 0, textDoc.lineCount ? textDoc.lineCount - 1 : 0);
            const sum_symbol = (item: vscode.DocumentSymbol, parent: SYMBOL.SymbolModel) => {
                const branch = new SYMBOL.SymbolModel(item.kind, item.name, file_name, item.range.start.line, item.range.end.line);
                for (const child of item.children) {
                    sum_symbol(child, branch);
                }
                parent.addChild(branch);
            };
            for (const item of symbols) {
                sum_symbol(item, root_symbol);
            }
            resolve( new CodeDocument(textDoc, short_name) );                            
        });
    }

    /**
     * ファイル一覧を収集する
     * @param folder フォルダ名
     * @returns ファイル一覧
     */
    private async _listFiles(folder: string): Promise<string[]> {
        let result: string[] = [];
        const entries = await fs.promises.readdir(folder, { withFileTypes: true });
        for (const entry of entries) {
            if (! entry.name.startsWith('.')) {
                const fullPath = path.join(folder, entry.name);
                if (entry.isDirectory()) {
                    result = result.concat(await this._listFiles(fullPath));
                } else if (entry.isFile()) {
                    result.push(fullPath);
                }
            }
        }
        return result;
    }

    /**
     * コード書類の読み込み
     * @param file ファイル名
     * @returns コード書類
     */
    private async _loadDocument(file: string): Promise<vscode.TextDocument | null> {
        let doc: vscode.TextDocument | null = null;
        try {
            return await vscode.workspace.openTextDocument(file);
        } catch (error) {
            return null;
        }
    }
}
