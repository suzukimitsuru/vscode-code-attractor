/* eslint-disable @typescript-eslint/naming-convention */

export class Symbol {
    public readonly kind: SymbolKind;
    public readonly name: string;
    public readonly startLine: number;
    public readonly endLine: number;
    public readonly lineCount: number;
    public readonly children: Symbol[] = [];
	public constructor(kind: SymbolKind, name: string, startLine: number, endLine: number) {
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

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
};