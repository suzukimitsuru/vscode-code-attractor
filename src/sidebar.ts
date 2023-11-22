import * as vscode from 'vscode';

/** @class 木構造の項目 */
export class TreeElement {
    /** 名前 */
    public readonly name: string;
    /** 子供達 */
    private _children: TreeElement[];
    /** 親 */
    private _parent: TreeElement | null;

	/** @constructor
	 * @param name 名前
	 */
    constructor(name: string) {
        this.name = name;
        this._children = [];
        this._parent = null;
    }
    /** @property 親 */
    get parent(): TreeElement | null {
        return this._parent;
    }

    /** @property 子供達 */
    get children(): TreeElement[] {
        return this._children;
    }

    /** @function 子供を追加 */
    addChild(child: TreeElement) {
        child.parent?.removeChild(child);
        this._children.push(child);
        child._parent = this;
    }

    /** @function 子供を削除 */
    removeChild(child: TreeElement) {
        const childIndex = this._children.indexOf(child);
        if (childIndex >= 0) {
            this._children.splice(childIndex, 1);
            child._parent = null;
        }
    }
}

/** @class 木構造の提供者 */
export class TreeProvider implements vscode.TreeDataProvider<TreeElement> {
    /** 根の項目 */
    private _root: TreeElement;
    /** @property 根の項目 */
    get root(): TreeElement { return this._root; }

    /** @constructor
     * @param root  根の項目
     */
    constructor(root: TreeElement) {
        this._root = root;
    }

    /** @function 木項目を返す
     * @param element 項目
     */
    getTreeItem(element: TreeElement): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const collapsibleState = element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        return new vscode.TreeItem(element.name, collapsibleState);
    }

    /** @function 子供達を返す
     * @param element 項目
     */
    getChildren(element?: TreeElement): vscode.ProviderResult<TreeElement[]> {
        return element ? element.children : this._root.children;
    }

    /** @event 変更イベント */
    private _changeEvent = new vscode.EventEmitter<void>();

    /** @property 木構造の変更イベントを返す */
    get onDidChangeTreeData(): vscode.Event<void> {
        return this._changeEvent.event;
    }

    /** @function 更新 */
    refresh() {
        this._changeEvent.fire();
    }
}
