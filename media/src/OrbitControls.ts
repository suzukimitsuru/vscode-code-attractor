import { Camera, MOUSE, TOUCH, Vector3, Vector2, Quaternion } from 'three';
import { PerspectiveCamera, OrthographicCamera, ArrayCamera, Spherical, Matrix4, Ray, Plane, MathUtils } from 'three';
import { ControlsBase, TouchEvents } from './ControlsBase';

enum STATE {
    none = - 1,
    simpleRotate = 0,
    simpleDolly = 1,
    simplePan = 2,
    touchRotate = 3,
    touchPan = 4,
    touchDollyPan = 5,
    touchDollyRotate = 6
};

const EPS: number = 0.000001;
const TILT_LIMIT = Math.cos( 70 * MathUtils.DEG2RAD );

/**
 * OrbitControls performs orbiting, dollying (zooming), and panning.
 * Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
 *
 *    Orbit - left mouse / touch: one-finger move
 *    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
 *    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
 */
export class OrbitControls extends ControlsBase {
    private _ray = new Ray();
    private _plane = new Plane();
    
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
		this.domElement.style.touchAction = 'none'; // 'none': disable touch scroll

		// Set to false to disable this control
		this.enabled = true;

		// Sets the 3D cursor (similar to Blender), from which the maxTargetRadius takes effect
		this.cursor = new Vector3();

		// How far you can dolly in and out ( PerspectiveCamera only )
		this.minDistance = 0;
		this.maxDistance = Infinity;

		// How far you can zoom in and out ( OrthographicCamera only )
		this.minZoom = 0;
		this.maxZoom = Infinity;

		// Limit camera target within a spherical area around the cursor
		this.minTargetRadius = 0;
		this.maxTargetRadius = Infinity;

		// How far you can orbit vertically, upper and lower limits.
		// Range is 0 to Math.PI radians.
		this.minPolarAngle = 0; // radians
		this.maxPolarAngle = Math.PI; // radians

		// How far you can orbit horizontally, upper and lower limits.
		// If set, the interval [ min, max ] must be a sub-interval of [ - 2 PI, 2 PI ], with ( max - min < 2 PI )
		this.minAzimuthAngle = - Infinity; // radians
		this.maxAzimuthAngle = Infinity; // radians

		// Set to true to enable damping (inertia)
		// If damping is enabled, you must call controls.update() in your animation loop
		this.enableDamping = false;
		this.dampingFactor = 0.05;

		// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
		// Set to false to disable zooming
		this.enableZoom = true;
		this.zoomSpeed = 1.0;

		// Set to false to disable rotating
		this.enableRotate = true;
		this.rotateSpeed = 1.0;

		// Set to false to disable panning
		this.enablePan = true;
		this.panSpeed = 1.0;
		this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
		this.keyPanSpeed = 7.0;	// pixels moved per arrow key push
		this.zoomToCursor = false;

		// Set to true to automatically rotate around the target
		// If auto-rotate is enabled, you must call controls.update() in your animation loop
		this.autoRotate = false;
		this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

		// The four arrow keys
		this.keys = { left: 'ArrowLeft', up: 'ArrowUp', right: 'ArrowRight', bottom: 'ArrowDown' };

		// Mouse buttons
		this.mouseButtons = { leftButton: MOUSE.ROTATE, middleButton: MOUSE.DOLLY, rightButton: MOUSE.PAN };

		// Touch fingers
		this.touches = { oneTouch: TOUCH.ROTATE, twoTouch: TOUCH.DOLLY_PAN };

		// for reset
		this.target0 = this.target.clone();
		this.position0 = this.camera.position.clone();
		if (this.camera instanceof PerspectiveCamera) { this.zoom0 = this.camera.zoom; }
		if (this.camera instanceof OrthographicCamera) { this.zoom0 = this.camera.zoom; }

		// the target DOM element for key events
		this._domElementKeyEvents = null;

        // Initialize

        this.state = STATE.none;

		// current position in spherical coordinates
		this.spherical = new Spherical();
		this.sphericalDelta = new Spherical();

        this.scale = 1;
		this.panOffset = new Vector3();

		this.rotateStart = new Vector2();
		this.rotateEnd = new Vector2();
		this.rotateDelta = new Vector2();

		this.panStart = new Vector2();
		this.panEnd = new Vector2();
		this.panDelta = new Vector2();

		this.dollyStart = new Vector2();
		this.dollyEnd = new Vector2();
		this.dollyDelta = new Vector2();

		this.dollyDirection = new Vector3();
		this.mouse = new Vector2();
		this.performCursorZoom = false;

        this._touches = new TouchEvents();

		// Add menu events
		this.domElement.addEventListener( 'contextmenu', this._onContextMenu );
        // Add push events
        this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.addEventListener( 'pointercancel', this._onPointerUp );
        // Add scroll events
		this.domElement.addEventListener( 'wheel', this._onMouseWheel, { passive: false } );

		// force an update at start
		this.update();
    }

    /**
     * Remove all the event listeners.
     */
    public dispose(): void {
        // Remove menu events
        this.domElement.removeEventListener( 'contextmenu', this._onContextMenu);
        // Remove push events
        this.domElement.removeEventListener( 'pointerdown', this._onPointerDown);
        this.domElement.removeEventListener( 'pointercancel', this._onPointerUp);
        // Remove scroll events
        this.domElement.removeEventListener( 'wheel', this._onMouseWheel);
        // Remove drag events
        this.domElement.removeEventListener( 'pointermove', this._onPointerMove);
        this.domElement.removeEventListener( 'pointerup', this._onPointerUp);
        // Remove keyboard events
        if ( this._domElementKeyEvents !== null ) {
            this._domElementKeyEvents.removeEventListener( 'keydown', this._onKeyDown);
            this._domElementKeyEvents = null;
        }

        //this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
    }

    //#region Propaties

        /**
         * When set to `false`, the controls will not respond to user input.
         * @default true
         */
        private enabled: boolean;

        /** @deprecated */
        ////private center: Vector3;

        /**
         * The focus point of the {@link .minTargetRadius} and {@link .maxTargetRadius} limits. It can be updated manually
         * at any point to change the center of interest for the {@link .target}.
         */
        private cursor: Vector3;

        /**
         * How far you can dolly in ( PerspectiveCamera only ).
         * @default 0
         */
        private minDistance: number;

        /**
         * How far you can dolly out ( PerspectiveCamera only ).
         * @default Infinity
         */
        private maxDistance: number;

        /**
         * How far you can zoom in ( OrthographicCamera only ).
         * @default 0
         */
        private minZoom: number;

        /**
         * How far you can zoom out ( OrthographicCamera only ).
         * @default Infinity
         */
        private maxZoom: number;

        /**
         * How close you can get the target to the 3D {@link .cursor}.
         * @default 0
         */
        private minTargetRadius: number;

        /**
         * How far you can move the target from the 3D {@link .cursor}.
         * @default Infinity
         */
        private maxTargetRadius: number;

        /**
         * How far you can orbit vertically, lower limit.
         * Range is 0 to Math.PI radians.
         * @default 0
         */
        private minPolarAngle: number;

        /**
         * How far you can orbit vertically, upper limit.
         * Range is 0 to Math.PI radians.
         * @default Math.PI.
         */
        private maxPolarAngle: number;

        /**
         * How far you can orbit horizontally, lower limit.
         * If set, the interval [ min, max ]
         * must be a sub-interval of [ - 2 PI, 2 PI ],
         * with ( max - min < 2 PI ).
         * @default Infinity
         */
        private minAzimuthAngle: number;

        /**
         * How far you can orbit horizontally, upper limit.
         * If set, the interval [ min, max ] must be a sub-interval
         * of [ - 2 PI, 2 PI ], with ( max - min < 2 PI ).
         * @default Infinity
         */
        private maxAzimuthAngle: number;

        /**
         * Set to true to enable damping (inertia), which can
         * be used to give a sense of weight to the controls.
         * Note that if this is enabled, you must call
         * .update () in your animation loop.
         * @default false
         */
        private enableDamping: boolean;

        /**
         * The damping inertia used if .enableDamping is set to true.
         * Note that for this to work,
         * you must call .update () in your animation loop.
         * @default 0.05
         */
        private dampingFactor: number;

        /**
         * Enable or disable zooming (dollying) of the camera.
         * @default true
         */
        private enableZoom: boolean;

        /**
         * Speed of zooming / dollying.
         * @default 1
         */
        private zoomSpeed: number;

        /**
         * Setting this property to `true` allows to zoom to the cursor's position.
         * @default false
         */
        private zoomToCursor: boolean;

        /**
         * Enable or disable horizontal and
         * vertical rotation of the camera.
         * Note that it is possible to disable a single axis
         * by setting the min and max of the polar angle or
         * azimuth angle to the same value, which will cause
         * the vertical or horizontal rotation to be fixed at that value.
         * @default true
         */
        private enableRotate: boolean;

        /**
         * Speed of rotation.
         * @default 1
         */
        private rotateSpeed: number;

        /**
         * Enable or disable camera panning.
         * @default true
         */
        private enablePan: boolean;

        /**
         * Speed of panning.
         * @default 1
         */
        private panSpeed: number;

        /**
         * Defines how the camera's position is translated when panning.
         * If true, the camera pans in screen space. Otherwise,
         * the camera pans in the plane orthogonal to the camera's
         * up direction. Default is true for OrbitControls; false for MapControls.
         * @default true
         */
        private screenSpacePanning: boolean;

        /**
         * How fast to pan the camera when the keyboard is used.
         * Default is 7.0 pixels per keypress.
         * @default 7
         */
        private keyPanSpeed: number;

        /**
         * Set to true to automatically rotate around the target.
         * Note that if this is enabled, you must call .update() in your animation loop. If you want the auto-rotate speed
         * to be independent of the frame rate (the refresh rate of the display), you must pass the time `deltaTime`, in
         * seconds, to .update().
         */
        private autoRotate: boolean;

        /**
         * How fast to rotate around the target if .autoRotate is true.
         * Default is 2.0, which equates to 30 seconds per orbit at 60fps.
         * Note that if .autoRotate is enabled, you must call
         * .update () in your animation loop.
         * @default 2
         */
        private autoRotateSpeed: number;

        /**
         * This object contains references to the keycodes for controlling
         * camera panning. Default is the 4 arrow keys.
         */
        private keys: { left: string; up: string; right: string; bottom: string };

        /**
         * This object contains references to the mouse actions used
         * by the controls.
         */
        private mouseButtons: {
            leftButton?: MOUSE | null | undefined;
            middleButton?: MOUSE | null | undefined;
            rightButton?: MOUSE | null | undefined;
        };

        /**
         * This object contains references to the touch actions used by
         * the controls.
         */
        private touches: { oneTouch?: TOUCH | null | undefined; twoTouch?: TOUCH | null | undefined };

        /**
         * Used internally by the .saveState and .reset methods.
         */
        private target0: Vector3;

        /**
         * Used internally by the .saveState and .reset methods.
         */
        private position0: Vector3;

        /**
         * Used internally by the .saveState and .reset methods.
         */
        private zoom0: number = 0;

		// the target DOM element for key events
        private _domElementKeyEvents: HTMLElement | null;

    //#endregion Propaties

    //#region public methods

        /**
         * Update the controls. Must be called after any manual changes to the camera's transform, or in the update loop if
         * .autoRotate or .enableDamping are set. `deltaTime`, in seconds, is optional, and is only required if you want the
         * auto-rotate speed to be independent of the frame rate (the refresh rate of the display).
         */
        public update(deltaTime?: number): boolean {
            const offset = new Vector3();

            // so camera.up is the orbit axis
            const quat = new Quaternion().setFromUnitVectors( this.camera.up, new Vector3( 0, 1, 0 ) );
            const quatInverse = quat.clone().invert();

            const lastPosition = new Vector3();
            const lastQuaternion = new Quaternion();
            const lastTargetPosition = new Vector3();

            const twoPI = 2 * Math.PI;


            const position = this.camera.position;

            offset.copy( position ).sub( this.target );

            // rotate offset to "y-axis-is-up" space
            offset.applyQuaternion( quat );

            // angle from z-axis around y-axis
            this.spherical.setFromVector3( offset );

            if ( this.autoRotate && this.state === STATE.none ) {
                this.rotateLeft( this.getAutoRotationAngle( deltaTime ? deltaTime : null ) );
            }

            const dampingFactor = this.enableDamping ? this.dampingFactor : 1;
            this.spherical.theta += this.sphericalDelta.theta * dampingFactor;
            this.spherical.phi += this.sphericalDelta.phi * dampingFactor;

            // restrict theta to be between desired limits
            let min = this.minAzimuthAngle;
            let max = this.maxAzimuthAngle;
            if ( isFinite( min ) && isFinite( max ) ) {
                if ( min < - Math.PI ) { min += twoPI; } else if ( min > Math.PI ) { min -= twoPI; }
                if ( max < - Math.PI ) { max += twoPI; } else if ( max > Math.PI ) { max -= twoPI; }
                if ( min <= max ) {
                    this.spherical.theta = Math.max( min, Math.min( max, this.spherical.theta ) );
                } else {
                    this.spherical.theta = (this.spherical.theta > (( min + max ) / 2))
                        ? Math.max( min, this.spherical.theta )
                        : Math.min( max, this.spherical.theta );
                }
            }

            // restrict phi to be between desired limits
            this.spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, this.spherical.phi ) );
            this.spherical.makeSafe();

            // move target to panned location
            if ( this.enableDamping === true ) {
                this.target.addScaledVector( this.panOffset, this.dampingFactor );
            } else {
                this.target.add( this.panOffset );
            }

            // Limit the target distance from the cursor to create a sphere around the center of interest
            this.target.sub( this.cursor );
            this.target.clampLength( this.minTargetRadius, this.maxTargetRadius );
            this.target.add( this.cursor );

            // adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
            // we adjust zoom later in these cases
            const radiusScale = (this.zoomToCursor && this.performCursorZoom || this.camera instanceof OrthographicCamera) ? 1 : this.scale;
            this.spherical.radius = this.clampDistance( this.spherical.radius *  radiusScale);
            offset.setFromSpherical( this.spherical );

            // rotate offset back to "camera-up-vector-is-up" space
            offset.applyQuaternion( quatInverse );
            position.copy( this.target ).add( offset );
            this.camera.lookAt( this.target );

            if ( this.enableDamping === true ) {
                this.sphericalDelta.theta *= ( 1 - this.dampingFactor );
                this.sphericalDelta.phi   *= ( 1 - this.dampingFactor );
                this.panOffset.multiplyScalar( 1 - this.dampingFactor );
            } else {
                this.sphericalDelta.set( 0, 0, 0 );
                this.panOffset.set( 0, 0, 0 );
            }

            // adjust camera position
            let zoomChanged = false;
            if ( this.zoomToCursor && this.performCursorZoom ) {

                let newRadius = null;
                if ( this.camera instanceof PerspectiveCamera ) {

                    // move the camera down the pointer ray
                    // this method avoids floating point error
                    const prevRadius = offset.length();
                    newRadius = this.clampDistance( prevRadius * this.scale );

                    const radiusDelta = prevRadius - newRadius;
                    this.camera.position.addScaledVector( this.dollyDirection, radiusDelta );
                    this.camera.updateMatrixWorld();

                } else if ( this.camera instanceof OrthographicCamera ) {

                    // adjust the ortho camera position based on zoom changes
                    const mouseBefore = new Vector3( this.mouse.x, this.mouse.y, 0 );
                    mouseBefore.unproject( this.camera );

                    this.camera.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.camera.zoom / this.scale ) );
                    this.camera.updateProjectionMatrix();
                    zoomChanged = true;

                    const mouseAfter = new Vector3( this.mouse.x, this.mouse.y, 0 );
                    mouseAfter.unproject( this.camera );

                    this.camera.position.sub( mouseAfter ).add( mouseBefore );
                    this.camera.updateMatrixWorld();

                    newRadius = offset.length();
                } else {
                    console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
                    this.zoomToCursor = false;
                }

                // handle the placement of the target
                if ( newRadius !== null ) {

                    if ( this.screenSpacePanning ) {

                        // position the orbit target in front of the new camera position
                        this.target.set( 0, 0, - 1 )
                            .transformDirection( this.camera.matrix )
                            .multiplyScalar( newRadius )
                            .add( this.camera.position );
                    } else {
                        // get the ray and translation plane to compute target
                        this._ray.origin.copy( this.camera.position );
                        this._ray.direction.set( 0, 0, - 1 ).transformDirection( this.camera.matrix );

                        // if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
                        // extremely large values
                        if ( Math.abs( this.camera.up.dot( this._ray.direction ) ) < TILT_LIMIT ) {
                            this.camera.lookAt( this.target );
                        } else {
                            this._plane.setFromNormalAndCoplanarPoint( this.camera.up, this.target );
                            this._ray.intersectPlane( this._plane, this.target );
                        }
                    }
                }

            } else if ( this.camera instanceof OrthographicCamera ) {
                this.camera.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.camera.zoom / this.scale ) );
                this.camera.updateProjectionMatrix();
                zoomChanged = true;
            }

            this.scale = 1;
            this.performCursorZoom = false;

            // update condition is:
            // min(camera displacement, camera rotation in radians)^2 > EPS
            // using small-angle approximation cos(x/2) = 1 - x^2 / 8

            if ( zoomChanged ||
                lastPosition.distanceToSquared( this.camera.position ) > EPS ||
                8 * ( 1 - lastQuaternion.dot( this.camera.quaternion ) ) > EPS ||
                lastTargetPosition.distanceToSquared( this.target ) > 0 ) {

                this.dispatchEvent( { type: 'change' } );

                lastPosition.copy( this.camera.position );
                lastQuaternion.copy( this.camera.quaternion );
                lastTargetPosition.copy( this.target );

                return true;
            }
            return false;
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

        /**
         * Adds key event listeners to the given DOM element. `window`
         * is a recommended argument for using this method.
         * @param domElement
         */
        public listenToKeyEvents(domElement: HTMLElement): void {
            domElement.addEventListener( 'keydown', this._onKeyDown );
            this._domElementKeyEvents = domElement;
        }

        /**
         * Removes the key event listener previously defined with {@link listenToKeyEvents}.
         */
        public stopListenToKeyEvents(): void {
            if (this._domElementKeyEvents) {
                this._domElementKeyEvents.removeEventListener( 'keydown', this._onKeyDown);
            }
			this._domElementKeyEvents = null;
        }

        /**
         * Save the current state of the controls. This can later be
         * recovered with .reset.
         */
        public saveState(): void {
			this.target0.copy( this.target );
			this.position0.copy( this.camera.position );
			if (this.camera instanceof PerspectiveCamera)   { this.zoom0 = this.camera.zoom; }
            if (this.camera instanceof OrthographicCamera)  { this.zoom0 = this.camera.zoom; }
        }

        /**
         * Reset the controls to their state from either the last time
         * the .saveState was called, or the initial state.
         */
        public reset(): void {
			this.target.copy( this.target0 );
			this.camera.position.copy( this.position0 );
            if (this.camera instanceof PerspectiveCamera
            || this.camera instanceof OrthographicCamera
            ) {
                this.camera.zoom = this.zoom0;
                this.camera.updateProjectionMatrix();
            }
			this.dispatchEvent( { type: 'change' } );

			this.update();

			this.state = STATE.none;
        }

        /**
         * Get the current vertical rotation, in radians.
         */
        public getPolarAngle(): number { return this.spherical.phi; }

        /**
         * Get the current horizontal rotation, in radians.
         */
        public getAzimuthalAngle(): number { return this.spherical.theta; }

        /**
         * Returns the distance from the camera to the target.
         */
        public getDistance(): number { return this.camera.position.distanceTo( this.target ); }

    //#endregion public methods

    //#region internals
    
        private state = STATE.none;

        // current position in spherical coordinates
        private readonly spherical: Spherical;
        private readonly sphericalDelta: Spherical;

		private scale: number;
		private readonly panOffset: Vector3;

		private readonly rotateStart: Vector2;
		private readonly rotateEnd: Vector2;
		private readonly rotateDelta: Vector2;

		private readonly panStart: Vector2;
		private readonly panEnd: Vector2;
		private readonly panDelta: Vector2;

		private readonly dollyStart: Vector2;
		private readonly dollyEnd: Vector2;
		private readonly dollyDelta: Vector2;

		private readonly dollyDirection: Vector3;
		private readonly mouse: Vector2;
		private performCursorZoom: boolean;

        /** @private タッチイベント */
        private readonly _touches: TouchEvents;

    //#endregion internals

    //#region Movement of viewpoint

        private getAutoRotationAngle(deltaTime: number | null): number {
            if ( deltaTime !== null ) {
                return ( 2 * Math.PI / 60 * this.autoRotateSpeed ) * deltaTime;
            } else {
                return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
            }
        }

        private getZoomScale(): number {
            return Math.pow( 0.95, this.zoomSpeed );
        }

        private rotateLeft(angle: number): void {
            this.sphericalDelta.theta -= angle;
        }

        private rotateUp(angle: number): void {
            this.sphericalDelta.phi -= angle;
        }

        private panLeft(distance: number, objectMatrix: Matrix4): void {
            const v = new Vector3();
            v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
            v.multiplyScalar( - distance );
            this.panOffset.add( v );
        }

        private panUp(distance: number, objectMatrix: Matrix4): void {
            const v = new Vector3();
            if ( this.screenSpacePanning === true ) {
                v.setFromMatrixColumn( objectMatrix, 1 );
            } else {
                v.setFromMatrixColumn( objectMatrix, 0 );
                v.crossVectors( this.camera.up, v );
            }
            v.multiplyScalar( distance );
            this.panOffset.add( v );
        }

        // deltaX and deltaY are in pixels; right and down are positive
        private pan(deltaX: number, deltaY: number): void {
            const clientWidth = this.domElement.clientWidth;
            const clientHeight = this.domElement.clientHeight;

            if (this.camera instanceof PerspectiveCamera) {

                // perspective
                const position = this.camera.position;
                const offset = new Vector3();
                offset.copy( position ).sub( this.target );
                let targetDistance = offset.length();

                // half of the fov is center to top of screen
                targetDistance *= Math.tan( ( this.camera.fov / 2 ) * Math.PI / 180.0 );

                // we use only clientHeight here so aspect ratio does not distort speed
                this.panLeft( 2 * deltaX * targetDistance / clientHeight, this.camera.matrix );
                this.panUp( 2 * deltaY * targetDistance / clientHeight, this.camera.matrix );
            } else if (this.camera instanceof OrthographicCamera) {

                // orthographic
                this.panLeft( deltaX * ( this.camera.right - this.camera.left ) / this.camera.zoom / clientWidth, this.camera.matrix );
                this.panUp( deltaY * ( this.camera.top - this.camera.bottom ) / this.camera.zoom / clientHeight, this.camera.matrix );
            } else {

                // camera neither orthographic nor perspective
                console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
                this.enablePan = false;
            }
        }

		private dollyOut(dollyScale: number) {
			if ( this.camera instanceof PerspectiveCamera || this.camera instanceof OrthographicCamera ) {
				this.scale /= dollyScale;
			} else {
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				this.enableZoom = false;
			}
		}

		private dollyIn(dollyScale: number) {
			if ( this.camera instanceof PerspectiveCamera || this.camera instanceof OrthographicCamera ) {
				this.scale *= dollyScale;
			} else {
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
				this.enableZoom = false;
			}
		}

		private updateMouseParameters(event: MouseEvent) {
			if ( ! this.zoomToCursor ) { return; }

			this.performCursorZoom = true;

			const rect = this.domElement.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			const w = rect.width;
			const h = rect.height;

			this.mouse.x = ( x / w ) * 2 - 1;
			this.mouse.y = - ( y / h ) * 2 + 1;

			this.dollyDirection.set( this.mouse.x, this.mouse.y, 1 ).unproject( this.camera ).sub( this.camera.position ).normalize();
		}

		private clampDistance(dist: number) {
			return Math.max( this.minDistance, Math.min( this.maxDistance, dist ) );
		}

    //#endregion Movement of viewpoint

    //#region event callbacks - update the object state

        private handleMouseDownRotate(event: MouseEvent): void {
            this.rotateStart.set( event.clientX, event.clientY );
        }

        private handleMouseDownDolly(event: MouseEvent): void {
            this.updateMouseParameters( event );
            this.dollyStart.set( event.clientX, event.clientY );
        }

        private handleMouseDownPan(event: MouseEvent): void {
            this.panStart.set( event.clientX, event.clientY );
        }

        private handleMouseMoveRotate(event: MouseEvent): void {
            this.rotateEnd.set( event.clientX, event.clientY );
            this.rotateDelta.subVectors( this.rotateEnd, this.rotateStart ).multiplyScalar( this.rotateSpeed );
            const clientHeight = this.domElement.clientHeight;
            this.rotateLeft( 2 * Math.PI * this.rotateDelta.x / clientHeight ); // yes, height
            this.rotateUp( 2 * Math.PI * this.rotateDelta.y / clientHeight );
            this.rotateStart.copy( this.rotateEnd );
            this.update();
        }

        private handleMouseMoveDolly(event: MouseEvent): void {
            this.dollyEnd.set( event.clientX, event.clientY );
            this.dollyDelta.subVectors( this.dollyEnd, this.dollyStart );
            if ( this.dollyDelta.y > 0 ) {
                this.dollyOut( this.getZoomScale() );
            } else if ( this.dollyDelta.y < 0 ) {
                this.dollyIn( this.getZoomScale() );
            }
            this.dollyStart.copy( this.dollyEnd );
            this.update();
        }

        private handleMouseMovePan(event: MouseEvent): void {
            this.panEnd.set( event.clientX, event.clientY );
            this.panDelta.subVectors( this.panEnd, this.panStart ).multiplyScalar( this.panSpeed );
            this.pan( this.panDelta.x, this.panDelta.y );
            this.panStart.copy( this.panEnd );
            this.update();
        }

        private handleMouseWheel(event: WheelEvent): void {
            this.updateMouseParameters( event );
            if ( event.deltaY < 0 ) {
                this.dollyIn( this.getZoomScale() );
            } else if ( event.deltaY > 0 ) {
                this.dollyOut( this.getZoomScale() );
            }
            this.update();
        }

        private handleKeyDown( event: KeyboardEvent ): void {
            let needsUpdate = false;
            const clientHeight = this.domElement.clientHeight;
            switch ( event.code ) {
                case this.keys.up:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        this.rotateUp( 2 * Math.PI * this.rotateSpeed / clientHeight );
                    } else {
                        this.pan( 0, this.keyPanSpeed );
                    }
                    needsUpdate = true;
                    break;
                case this.keys.bottom:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        this.rotateUp( - 2 * Math.PI * this.rotateSpeed / clientHeight );
                    } else {
                        this.pan( 0, - this.keyPanSpeed );
                    }
                    needsUpdate = true;
                    break;
                case this.keys.left:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        this.rotateLeft( 2 * Math.PI * this.rotateSpeed / clientHeight );
                    } else {
                        this.pan( this.keyPanSpeed, 0 );
                    }
                    needsUpdate = true;
                    break;
                case this.keys.right:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        this.rotateLeft( - 2 * Math.PI * this.rotateSpeed / clientHeight );
                    } else {
                        this.pan( - this.keyPanSpeed, 0 );
                    }
                    needsUpdate = true;
                    break;
            }
            if ( needsUpdate ) {

                // prevent the browser from scrolling on cursor keys
                event.preventDefault();

                this.update();
            }
        }

		private handleTouchStartRotate(): void {
			if ( this._touches.fingers() === 1 ) {
				this.rotateStart.copy( this._touches.position(0) );
			} else {
                const center = this._touches.twoCenter();
				this.rotateStart.set( 0.5 * center.x, 0.5 * center.y );
			}
		}

		private handleTouchStartPan(): void {
			if ( this._touches.fingers() === 1 ) {
				this.panStart.copy( this._touches.position(0) );
			} else {
                const sum = this._touches.twoCenter();
				this.panStart.set( 0.5 * sum.x, 0.5 * sum.y );
			}
		}

		private handleTouchStartDolly(): void {
            const difference = this._touches.twoDifference();
			const distance = Math.sqrt( (difference.x * difference.x) + (difference.y * difference.y) );
			this.dollyStart.set( 0, distance );
		}

		private handleTouchStartDollyPan(): void {
			if ( this.enableZoom ) { this.handleTouchStartDolly(); }
			if ( this.enablePan ) { this.handleTouchStartPan(); }
		}

		private handleTouchStartDollyRotate(): void {
			if ( this.enableZoom ) { this.handleTouchStartDolly(); }
			if ( this.enableRotate ) { this.handleTouchStartRotate(); }
		}

		private handleTouchMoveRotate(event: PointerEvent): void {
			if ( this._touches.fingers() === 1 ) {
				this.rotateEnd.set( event.pageX, event.pageY );
			} else {
				const position = this._touches.getSecondPosition( event );
				this.rotateEnd.set( 0.5 * ( event.pageX + position.x ), 0.5 * ( event.pageY + position.y ) );
			}
			this.rotateDelta.subVectors( this.rotateEnd, this.rotateStart ).multiplyScalar( this.rotateSpeed );
			const clientHeight = this.domElement.clientHeight;
			this.rotateLeft( 2 * Math.PI * this.rotateDelta.x / clientHeight ); // yes, height
			this.rotateUp( 2 * Math.PI * this.rotateDelta.y / clientHeight );
			this.rotateStart.copy( this.rotateEnd );
		}

		private handleTouchMovePan(event: PointerEvent): void {
			if ( this._touches.fingers() === 1 ) {
				this.panEnd.set( event.pageX, event.pageY );
			} else {
				const position = this._touches.getSecondPosition( event );
				this.panEnd.set(  0.5 * ( event.pageX + position.x ), 0.5 * ( event.pageY + position.y ) );
			}
			this.panDelta.subVectors( this.panEnd, this.panStart ).multiplyScalar( this.panSpeed );
			this.pan( this.panDelta.x, this.panDelta.y );
			this.panStart.copy( this.panEnd );
		}

		private handleTouchMoveDolly(event: PointerEvent): void {
			const position = this._touches.getSecondPosition( event );
			const dx = event.pageX - position.x;
			const dy = event.pageY - position.y;
			const distance = Math.sqrt( dx * dx + dy * dy );
			this.dollyEnd.set( 0, distance );
			this.dollyDelta.set( 0, Math.pow( this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed ) );
			this.dollyOut( this.dollyDelta.y );
			this.dollyStart.copy( this.dollyEnd );
		}

		private handleTouchMoveDollyPan(event: PointerEvent): void {
			if ( this.enableZoom ) { this.handleTouchMoveDolly( event ); }
			if ( this.enablePan ) { this.handleTouchMovePan( event ); }
		}

		private handleTouchMoveDollyRotate(event: PointerEvent): void {
			if ( this.enableZoom ) { this.handleTouchMoveDolly( event ); }
			if ( this.enableRotate ) { this.handleTouchMoveRotate( event ); }
		}

    //#endregion event callbacks - update the object state

    //#region event handlers - FSM: listen for events and reset state

        private _onPointerDown = (event: PointerEvent): void => {
            this.dispatchEvent({ type: 'debug', message: `onPointerDown(${event.pointerType}) enabled:${this.enabled}` });
            if ( this.enabled === false ) { return; }
            if ( this._touches.fingers() === 0 ) {
                this.domElement.setPointerCapture( event.pointerId );
                this.domElement.addEventListener('pointermove', this._onPointerMove );
                this.domElement.addEventListener('pointerup', this._onPointerUp );
            }

            // タッチを追加
            this._touches.add( event );

            if ( event.pointerType === 'touch' ) {
                this.onTouchStart( event );
            } else {
                this.onMouseDown( event );
            }
        };

        private _onPointerMove = (event: PointerEvent): void => {
            this.dispatchEvent({type: 'debug', message: `onPointerMove(${event.pointerType})`});
            if ( this.enabled === false ) { return; }
            if ( event.pointerType === 'touch' ) {
                this.onTouchMove( event );
            } else {
                this.onMouseMove( event );
            }
        };

        private _onPointerUp = (event: PointerEvent): void => {
            this.dispatchEvent({ type: 'debug', message: `onPointerUp(${event.pointerType}) enabled:${this.enabled}` });
            this._touches.remove( event );
            if ( this._touches.fingers() === 0 ) {
                this.domElement.releasePointerCapture( event.pointerId );
                this.domElement.removeEventListener( 'pointermove', this._onPointerMove);
                this.domElement.removeEventListener( 'pointerup', this._onPointerUp);
            }
            this.dispatchEvent( { type: 'end' } );
            this.state = STATE.none;
        };

        private onMouseDown(event: MouseEvent): void {
            let mouseAction;
            switch ( event.button ) {
                case 0:
                    mouseAction = this.mouseButtons.leftButton;
                    break;
                case 1:
                    mouseAction = this.mouseButtons.middleButton;
                    break;
                case 2:
                    mouseAction = this.mouseButtons.rightButton;
                    break;
                default:
                    mouseAction = - 1;
                    break;
            }
            switch ( mouseAction ) {
                case MOUSE.DOLLY:
                    if ( this.enableZoom === false ) { return; }
                    this.handleMouseDownDolly( event );
                    this.state = STATE.simpleDolly;
                    break;
                case MOUSE.ROTATE:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        if ( this.enablePan === false ) { return; }
                        this.handleMouseDownPan( event );
                        this.state = STATE.simplePan;
                    } else {
                        if ( this.enableRotate === false ) { return; }
                        this.handleMouseDownRotate( event );
                        this.state = STATE.simpleRotate;
                    }
                    break;
                case MOUSE.PAN:
                    if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                        if ( this.enableRotate === false ) { return; }
                        this.handleMouseDownRotate( event );
                        this.state = STATE.simpleRotate;
                    } else {
                        if ( this.enablePan === false ) { return; }
                        this.handleMouseDownPan( event );
                        this.state = STATE.simplePan;
                    }
                    break;
                default:
                    this.state = STATE.none;
                    break;
            }
            if ( this.state !== STATE.none ) {
                this.dispatchEvent( { type: 'start' } );
            }
        }

        private onMouseMove(event: MouseEvent): void {
            switch ( this.state ) {
                case STATE.simpleRotate:
                    if ( this.enableRotate === false ) { return; }
                    this.handleMouseMoveRotate( event );
                    break;
                case STATE.simpleDolly:
                    if ( this.enableZoom === false ) { return; }
                    this.handleMouseMoveDolly( event );
                    break;
                case STATE.simplePan:
                    if ( this.enablePan === false ) { return; }
                    this.handleMouseMovePan( event );
                    break;
            }
        }

        private _onMouseWheel = (event: WheelEvent): void => {
            this.dispatchEvent({ type: 'debug', message: `onMouseWheel() enabled:${this.enabled} enableZoom:${this.enableZoom} state:${this.state}` });
            if ( this.enabled === false || this.enableZoom === false || this.state !== STATE.none ) { return; }
            event.preventDefault();
            this.dispatchEvent( { type: 'start' } );
            this.handleMouseWheel( event );
            this.dispatchEvent( { type: 'end' } );
        };


        private _onKeyDown = (event: KeyboardEvent ): void => {
            if ( this.enabled === false || this.enablePan === false ) { return; }
            this.handleKeyDown( event );
        };

		private onTouchStart(event: PointerEvent): void {
			this._touches.track( event );
			switch ( this._touches.fingers() ) {
				case 1:
					switch ( this.touches.oneTouch ) {
						case TOUCH.ROTATE:
							if ( this.enableRotate === false ) { return; }
							this.handleTouchStartRotate();
							this.state = STATE.touchRotate;
							break;
						case TOUCH.PAN:
							if ( this.enablePan === false ) { return; }
							this.handleTouchStartPan();
							this.state = STATE.touchPan;
							break;
						default:
							this.state = STATE.none;
                            break;
					}
					break;
				case 2:
					switch ( this.touches.twoTouch ) {
						case TOUCH.DOLLY_PAN:
							if ( this.enableZoom === false && this.enablePan === false ) { return; }
							this.handleTouchStartDollyPan();
							this.state = STATE.touchDollyPan;
							break;
						case TOUCH.DOLLY_ROTATE:
							if ( this.enableZoom === false && this.enableRotate === false ) { return; }
							this.handleTouchStartDollyRotate();
							this.state = STATE.touchDollyRotate;
							break;
						default:
							this.state = STATE.none;
                            break;
					}
					break;
				default:
					this.state = STATE.none;
                    break;
			}
			if ( this.state !== STATE.none ) {
				this.dispatchEvent( { type: 'start' } );
			}
		}

		private onTouchMove(event: PointerEvent): void {
			this._touches.track( event );
			switch ( this.state ) {
				case STATE.touchRotate:
					if ( this.enableRotate === false ) { return; };
					this.handleTouchMoveRotate( event );
					this.update();
					break;
				case STATE.touchPan:
					if ( this.enablePan === false ) { return; }
					this.handleTouchMovePan( event );
					this.update();
					break;
				case STATE.touchDollyPan:
					if ( this.enableZoom === false && this.enablePan === false ) { return; }
					this.handleTouchMoveDollyPan( event );
					this.update();
					break;
				case STATE.touchDollyRotate:
					if ( this.enableZoom === false && this.enableRotate === false ) { return; }
					this.handleTouchMoveDollyRotate( event );
					this.update();
					break;
				default:
					this.state = STATE.none;
                    break;
			}
		}

		private _onContextMenu = (event: MouseEvent): void => {
            this.dispatchEvent({ type: 'debug', message: `onContextMenu() enabled:${this.enabled}` });
			if ( this.enabled === false ) { return; }
			event.preventDefault();
		};

    //#endregion event handlers - FSM: listen for events and reset state
}