import { Camera, Vector3 } from 'three';
import { PerspectiveCamera, OrthographicCamera, ArrayCamera, Euler } from 'three';
import { ControlsBase, TouchEvents } from './ControlsBase';

/**
 * OrbitControls performs orbiting, dollying (zooming), and panning.
 * Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
 *
 *    Orbit - left mouse / touch: one-finger move
 *    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
 *    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
 */
export class WalkThroughControls extends ControlsBase {

    //#region Internal

        private readonly _euler = new Euler( 0, 0, 0, 'YXZ' );

        private readonly _vector = new Vector3();

        private readonly _pai2 = Math.PI / 2;

        private readonly zoomSpeed = 1.0;

        private calcZoomScale(): number {
            return Math.pow( 0.95, this.zoomSpeed );
        }

        /** @private タッチイベント */
        private readonly _touches: TouchEvents;

    //#endregion Internal

    //#region Target

        /**
         * The camera being controlled.
         */
        camera: Camera;

        /**
         * The HTMLElement used to listen for mouse / touch events.
         * This must be passed in the constructor;
         * changing it here will not set up new event listeners.
         */
        domElement: HTMLElement;
    
    //#endregion Target

    /**
     * Orbit controls allow the camera to orbit around a target.
     * @param camera - The camera to be controlled.
     * The camera must not be a child of another object, unless that object is the scene itself.
     * @param domElement - The HTML element used for event listeners.
     */
    public constructor(camera: Camera, domElement: HTMLElement) {
        super();

        this.camera = camera;
        this.domElement = domElement;
		this.domElement.style.touchAction = 'auto'; // 'none': disable touch scroll

        // Range is 0 to Math.PI radians
        this.minPolarAngle = 0; // radians
        this.maxPolarAngle = Math.PI; // radians

        this._touches = new TouchEvents();

        // カメラの方向イベントを追加
        this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.addEventListener( 'pointercancel', this._onPointerUp );
        // カメラの前後・左右・上下イベントを追加
		this.domElement.addEventListener( 'wheel', this._onMouseWheel, { passive: false } );
        document.addEventListener('keydown', this._onKeyDown, false);
    }

    /**
     * Remove all the event listeners.
     */
    public dispose(): void {
        // カメラの前後・左右・上下イベントを削除
        document.removeEventListener( 'keydown', this._onKeyDown );
        this.domElement.removeEventListener( 'wheel', this._onMouseWheel);
        // カメラの方向イベントを削除
        this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
		this.domElement.removeEventListener( 'pointercancel', this._onPointerUp );
        this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
    }

    //#region Propaties

        public minPolarAngle: number;
        public maxPolarAngle: number;

        //public pointerSpeed: number;

    //#endregion Propaties

    //#region public methods

        /**
         * Update the controls. Must be called after any manual changes to the camera's transform, or in the update loop if
         * .autoRotate or .enableDamping are set. `deltaTime`, in seconds, is optional, and is only required if you want the
         * auto-rotate speed to be independent of the frame rate (the refresh rate of the display).
         */
        public update(deltaTime?: number): boolean {
            return true;
        }

        /**
         * Resize view
         * @param aspect aspect rate (width / height)
         */
        public resize(aspect: number): void {
            this.dispatchEvent({ type: 'debug', message: `resize() aspect:${aspect}` });
            if (this.camera instanceof PerspectiveCamera
            || this.camera instanceof ArrayCamera) {
                this.camera.aspect = aspect;
                this.camera.updateProjectionMatrix();
            }
        }

    //#endregion public methods

    //#region event handlers

        /**
         * Pointer down event listener
         * @param event Pointer Event
         */
        private _onPointerDown = (event: PointerEvent): void => {

            // タッチが無かったら
            if ( this._touches.fingers() === 0 ) {

                // ポインタを確保
                this.domElement.setPointerCapture( event.pointerId );

                // イベントを登録
                this.domElement.addEventListener('pointermove', this._onPointerMove );
                this.domElement.addEventListener('pointerup', this._onPointerUp );
            }

            // タッチを追加
            this._touches.add( event );

            this.dispatchEvent( { type: 'start' } );
        };

        /**
         * Pointer up event listener
         * @param event Pointer Event
         */
        private _onPointerUp = (event: PointerEvent): void => {

            // タッチを削除
            this._touches.remove( event );

            // タッチがなくなったら
            if ( this._touches.fingers() === 0 ) {

                // ポインタを解放
                this.domElement.releasePointerCapture( event.pointerId );

                // イベントを削除
                this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
                this.domElement.removeEventListener( 'pointerup', this._onPointerUp );
            }
            this.dispatchEvent( { type: 'end' } );
            this.dispatchEvent( { type: 'change' } );
        };

        /**
         * Pointer move event listener
         * @param event Pointer Event
         */
        private _onPointerMove = (event: PointerEvent): void => {
            this._euler.setFromQuaternion( this.camera.quaternion );
            this._euler.y += event.movementX * 0.001;
            this._euler.x += event.movementY * 0.001;
            this._euler.x = Math.max( this._pai2 - this.maxPolarAngle, Math.min( this._pai2 - this.minPolarAngle, this._euler.x ) );
            this.camera.quaternion.setFromEuler( this._euler );
        };

        /**
         * Wheel scroll event listener
         * @param event Wheel Event
         */
        private _onMouseWheel = (event: WheelEvent): void => {
            this.dispatchEvent( { type: 'start' } );

            // カメラの方向ベクトルを取得
            const direction = new Vector3();
            this.camera.getWorldDirection(direction);

            // カメラの位置を更新
            this.camera.position.add(direction.multiplyScalar( -event.deltaY ));

            this.dispatchEvent( { type: 'end' } );
            this.dispatchEvent( { type: 'change' } );
        };

        /**
         * Key down event listener
         * @param event Keybord event
         */
        private _onKeyDown = (event: KeyboardEvent): void => {
            let direction = '';
            const unit = 10;
            let forward = 0;
            let right = 0;
            let up = 0;
            switch (event.code) {
                case 'KeyW':
                    direction = 'Forward';
                    forward = unit;
                    break;
                case 'KeyS':
                    direction = 'Backward';
                    forward = -unit;
                    break;
                case 'KeyA':
                    direction = 'Left';
                    right = -unit;
                    break;
                case 'KeyD':
                    direction = 'Right';
                    right = unit;
                    break;
                case 'KeyQ':
                    direction = 'Up';
                    up = unit;
                    break;
                case 'KeyE':
                    direction = 'Down';
                    up = -unit;
                    break;
            }
            if (direction.length > 0) {
                this.dispatchEvent( { type: 'start' } );

                if (forward !== 0) {
                    // move forward parallel to the xz-plane
                    // assumes camera.up is y-up
                    this.target.setFromMatrixColumn( this.camera.matrix, 0 );
                    this.target.crossVectors( this.camera.up, this.target );
                    this.camera.position.addScaledVector( this.target, forward );
                }
                if (right !== 0) {
                    this.target.setFromMatrixColumn( this.camera.matrix, 0 );
                    this.camera.position.addScaledVector( this.target, right );
                }
                if (up !== 0) {
                    this.camera.position.y += up;
                }

                this.dispatchEvent( { type: 'end' } );
                this.dispatchEvent( { type: 'change' } );
            }
        };

    //#endregion event handlers
}
