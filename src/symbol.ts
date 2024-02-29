import * as vscode from 'vscode';

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
    public readonly kind: vscode.SymbolKind;
    public readonly name: string;
    public readonly filename: string;
    public readonly startLine: number;
    public readonly endLine: number;
    public readonly lineCount: number;
    public updateId: string = '';
    public position: Position | null = null;
    public quaternion: Quaternion | null = null;
    public children: Symbol[] = [];
	public constructor(kind: vscode.SymbolKind, name: string, filename: string, startLine: number, endLine: number,
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
