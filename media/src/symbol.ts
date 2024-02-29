/* eslint-disable @typescript-eslint/naming-convention */

class Vector {
    public constructor(public x: number, public y: number, public z: number) {}
}
export class Position extends Vector {
    public constructor(x: number, y: number, z: number) { super(x, y, z); }
    public set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
export class Quaternion extends Vector {
    public constructor(x: number, y: number, z: number, public w: number) { super(x, y, z); }
    public set(x: number, y: number, z: number, w: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
}

export class Symbol {
    public readonly kind: SymbolKind;
    public readonly name: string;
    public readonly filename: string;
    public readonly startLine: number;
    public readonly endLine: number;
    public readonly lineCount: number;
    public updateId: string = '';
    public position: Position | null = null;
    public quaternion: Quaternion | null = null;
    public children: Symbol[] = [];
	public constructor(kind: SymbolKind, name: string, filename: string, startLine: number, endLine: number,
        updateId: string = '', position: Position | null = null, quaternion: Quaternion | null = null) {
        this.kind = kind;
        this.name = name;
        this.filename = filename;
        this.startLine = startLine;
        this.endLine = endLine;
        this.lineCount = endLine - startLine + 1;
        this.updateId = updateId;
        this.position = position ? new Position(position.x, position.y, position.z) : null;
        this.quaternion = quaternion ? new Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w): null;
    }
    public addChild(child: Symbol) {
        this.children.push(child);
    }
    public setPosition(x: number, y: number, z: number) {
        if (this.position) {
            this.position.set(x, y, z);
        } else {
            this.position = new Position(x, y, z);
        }
    } 
    public setQuaternion(x: number, y: number, z: number, w: number) {
        if (this.quaternion) {
            this.quaternion.set(x, y, z, w);
        } else {
            this.quaternion = new Quaternion(x, y, z, w);
        }
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