import { EventDispatcher, Vector3, Vector2 } from 'three';

/** 制御イベント */
interface ControlsEventMap {
	change: { type: 'change'; };
	start:  { type: 'start'; };
	end:    { type: 'end'; };
	debug:  { type: 'debug'; message: string; };
}

/** @class コントロール基本クラス */
export abstract class ControlsBase extends EventDispatcher<ControlsEventMap> {
	/**
	 * The focus point of the controls, the .object orbits around this.
	 * It can be updated manually at any point to change the focus
	 * of the controls.
	 */
	public target: Vector3;

	/** @constructor コンストラクタ */
	constructor() {
		super();

		// "target" sets the location of focus, where the object orbits around
		this.target = new Vector3();
	}

	/** @function 破棄 */
	public abstract dispose(): void;

	/**
	 * @function 更新
	 * @param deltaTime 日時
	 */
	public abstract update(deltaTime?: number): boolean;

	/**
	 * @function サイズ変更
	 * @param aspect 縦横比
	 */
	public abstract resize(aspect: number): void;
}

/** @class タッチイベント */
export class TouchEvents {

	/** @private イベント配列 */
    private _events: PointerEvent[];

	/** @private 位置配列 */
    private _positions: Vector2[];

	/**
	 * @constructor コンストラクタ
	 */
    constructor() {
        this._events = [];
        this._positions = [];
    }

	/**
	 * @function イベントの追加
	 * @param event ポインタイベント
	 */
    public add(event: PointerEvent): void {
        this._events.push( event );
    }

	/**
	 * @function イベントの削除
	 * @param event ポインタイベント
	 */
    public remove(event: PointerEvent): void {
        delete this._positions[ event.pointerId ];
        for ( let i = 0; i < this._events.length; i ++ ) {
            if ( this._events[ i ].pointerId === event.pointerId ) {
                this._events.splice( i, 1 );
                break;
            }
        }
    }

	/**
	 * @function イベントの追跡
	 * @param event ポインタイベント
	 */
    public track(event: PointerEvent): void {
        let position = this._positions[ event.pointerId ];
        if ( position === undefined ) {
            position = new Vector2();
            this._positions[ event.pointerId ] = position;
        }
        position.set( event.pageX, event.pageY );
    }

	/**
	 * @function 指の数を返す
	 * @returns 指の数
	 */
    public fingers(): number { return this._events.length; }

	/**
	 * @function タッチ位置を返す
	 * @param index インデックス(0-)
	 * @returns タッチ位置
	 */
    public position(index: number): Vector2 { return new Vector2(this._events[index].pageX, this._events[index].pageY); }

	/**
	 * @function 二本指タッチの中心位置を返す
	 * @returns 中心位置
	 */
    public twoCenter(): Vector2 { return new Vector2(
        this._events[0].pageX + this._events[1].pageX,
        this._events[0].pageY + this._events[1].pageY);
    }

	/**
	 * @function 二本指の差分位置を返す
	 * @returns 差分位置
	 */
    public twoDifference(): Vector2 { return new Vector2(
        this._events[0].pageX - this._events[1].pageX,
        this._events[0].pageY - this._events[1].pageY);
    }

	/**
	 * @function ２番目の位置を返す
	 * @param event 位置
	 * @returns 
	 */
    public getSecondPosition(event: PointerEvent): Vector2 {
        const pointer = (event.pointerId === this._events[0].pointerId) ? this._events[1] : this._events[0];
        return this._positions[ pointer.pointerId ];
    }
}
