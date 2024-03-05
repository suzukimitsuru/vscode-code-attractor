import { Camera, EventDispatcher, MOUSE, Quaternion, Spherical, TOUCH, Vector2, Vector3, Plane, Ray, MathUtils,
    PerspectiveCamera, OrthographicCamera, Matrix4 } from 'three';

// OrbitControls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

export interface WalkThroughControlsEventMap {
    change: { type: 'change' };
    start: { type: 'start' };
    end: { type: 'end' };
}

const _changeEvent = { type: 'change' };
const _startEvent = { type: 'start' };
const _endEvent = { type: 'end' };
const _ray = new Ray();
const _plane = new Plane();
const TILT_LIMIT = Math.cos( 70 * MathUtils.DEG2RAD );

    enum STATE {
        NONE = -1,
        ROTATE = 0,
        DOLLY = 1,
        PAN = 2,
        TOUCH_ROTATE = 3,
        TOUCH_PAN = 4,
        TOUCH_DOLLY_PAN = 5,
        TOUCH_DOLLY_ROTATE = 6
    };

/**
 * Orbit controls allow the camera to orbit around a target.
 * @param object - The camera to be controlled. The camera must not
 * be a child of another object, unless that object is the scene itself.
 * @param domElement - The HTML element used for
 * event listeners.
 */
export class WalkThroughControls extends EventDispatcher<WalkThroughControlsEventMap> {
    private _event: WalkThroughControlsEventMap = {
        change: { type: 'change' },
        start: { type: 'start' },
        end: { type: 'end' }
    };

    private _domElementKeyEvents: HTMLElement | null;
    
    private EPS = 0.000001;
    private state: STATE = STATE.NONE;

    // current position in spherical coordinates
    private spherical = new Spherical();
    private sphericalDelta = new Spherical();

    private scale = 1;
    private panOffset = new Vector3();

    private rotateStart = new Vector2();
    private rotateEnd = new Vector2();
    private rotateDelta = new Vector2();

    private panStart = new Vector2();
    private panEnd = new Vector2();
    private panDelta = new Vector2();

    private dollyStart = new Vector2();
    private dollyEnd = new Vector2();
    private dollyDelta = new Vector2();

    private dollyDirection = new Vector3();
    private mouse = new Vector2();
    private performCursorZoom = false;

    private pointers: PointerEvent[] = [];
    private pointerPositions: Vector2[] = [];

    /**
     * The camera being controlled.
     */
    public object: Camera;

    /**
     * The HTMLElement used to listen for mouse / touch events.
     * This must be passed in the constructor;
     * changing it here will not set up new event listeners.
     */
    public domElement: HTMLElement | Document;

    /**
     * When set to `false`, the controls will not respond to user input.
     * @default true
     */
    public enabled: boolean;

    /**
     * The focus point of the controls, the .object orbits around this.
     * It can be updated manually at any point to change the focus
     * of the controls.
     */
    target: Vector3;

    /** @deprecated */
    //center: Vector3;

    /**
     * The focus point of the {@link .minTargetRadius} and {@link .maxTargetRadius} limits. It can be updated manually
     * at any point to change the center of interest for the {@link .target}.
     */
    cursor: Vector3;

    /**
     * How far you can dolly in ( PerspectiveCamera only ).
     * @default 0
     */
    minDistance: number;

    /**
     * How far you can dolly out ( PerspectiveCamera only ).
     * @default Infinity
     */
    maxDistance: number;

    /**
     * How far you can zoom in ( OrthographicCamera only ).
     * @default 0
     */
    minZoom: number;

    /**
     * How far you can zoom out ( OrthographicCamera only ).
     * @default Infinity
     */
    maxZoom: number;

    /**
     * How close you can get the target to the 3D {@link .cursor}.
     * @default 0
     */
    minTargetRadius: number;

    /**
     * How far you can move the target from the 3D {@link .cursor}.
     * @default Infinity
     */
    maxTargetRadius: number;

    /**
     * How far you can orbit vertically, lower limit.
     * Range is 0 to Math.PI radians.
     * @default 0
     */
    minPolarAngle: number;

    /**
     * How far you can orbit vertically, upper limit.
     * Range is 0 to Math.PI radians.
     * @default Math.PI.
     */
    maxPolarAngle: number;

    /**
     * How far you can orbit horizontally, lower limit.
     * If set, the interval [ min, max ]
     * must be a sub-interval of [ - 2 PI, 2 PI ],
     * with ( max - min < 2 PI ).
     * @default Infinity
     */
    minAzimuthAngle: number;

    /**
     * How far you can orbit horizontally, upper limit.
     * If set, the interval [ min, max ] must be a sub-interval
     * of [ - 2 PI, 2 PI ], with ( max - min < 2 PI ).
     * @default Infinity
     */
    maxAzimuthAngle: number;

    /**
     * Set to true to enable damping (inertia), which can
     * be used to give a sense of weight to the controls.
     * Note that if this is enabled, you must call
     * .update () in your animation loop.
     * @default false
     */
    enableDamping: boolean;

    /**
     * The damping inertia used if .enableDamping is set to true.
     * Note that for this to work,
     * you must call .update () in your animation loop.
     * @default 0.05
     */
    dampingFactor: number;

    /**
     * Enable or disable zooming (dollying) of the camera.
     * @default true
     */
    enableZoom: boolean;

    /**
     * Speed of zooming / dollying.
     * @default 1
     */
    zoomSpeed: number;

    /**
     * Setting this property to `true` allows to zoom to the cursor's position.
     * @default false
     */
    zoomToCursor: boolean;

    /**
     * Enable or disable horizontal and
     * vertical rotation of the camera.
     * Note that it is possible to disable a single axis
     * by setting the min and max of the polar angle or
     * azimuth angle to the same value, which will cause
     * the vertical or horizontal rotation to be fixed at that value.
     * @default true
     */
    enableRotate: boolean;

    /**
     * Speed of rotation.
     * @default 1
     */
    rotateSpeed: number;

    /**
     * Enable or disable camera panning.
     * @default true
     */
    enablePan: boolean;

    /**
     * Speed of panning.
     * @default 1
     */
    panSpeed: number;

    /**
     * Defines how the camera's position is translated when panning.
     * If true, the camera pans in screen space. Otherwise,
     * the camera pans in the plane orthogonal to the camera's
     * up direction. Default is true for OrbitControls; false for MapControls.
     * @default true
     */
    screenSpacePanning: boolean;

    /**
     * How fast to pan the camera when the keyboard is used.
     * Default is 7.0 pixels per keypress.
     * @default 7
     */
    keyPanSpeed: number;

    /**
     * Set to true to automatically rotate around the target.
     * Note that if this is enabled, you must call .update() in your animation loop. If you want the auto-rotate speed
     * to be independent of the frame rate (the refresh rate of the display), you must pass the time `deltaTime`, in
     * seconds, to .update().
     */
    autoRotate: boolean;

    /**
     * How fast to rotate around the target if .autoRotate is true.
     * Default is 2.0, which equates to 30 seconds per orbit at 60fps.
     * Note that if .autoRotate is enabled, you must call
     * .update () in your animation loop.
     * @default 2
     */
    autoRotateSpeed: number;

    /**
     * This object contains references to the keycodes for controlling
     * camera panning. Default is the 4 arrow keys.
     */
    keys: { LEFT: string; UP: string; RIGHT: string; BOTTOM: string };

    /**
     * This object contains references to the mouse actions used
     * by the controls.
     */
    mouseButtons: {
        LEFT?: MOUSE | null | undefined;
        MIDDLE?: MOUSE | null | undefined;
        RIGHT?: MOUSE | null | undefined;
    };

    /**
     * This object contains references to the touch actions used by
     * the controls.
     */
    touches: { ONE?: TOUCH | null | undefined; TWO?: TOUCH | null | undefined };

    /**
     * Used internally by the .saveState and .reset methods.
     */
    target0: Vector3;

    /**
     * Used internally by the .saveState and .reset methods.
     */
    position0: Vector3;

    /**
     * Used internally by the .saveState and .reset methods.
     */
    zoom0: number;

    constructor(object: Camera, domElement: HTMLElement) {
        super();

        this.object = object;
        this.domElement = domElement;
        this.domElement.style.touchAction = 'none'; // disable touch scroll

        // Set to false to disable this control
        this.enabled = true;

        // "target" sets the location of focus, where the object orbits around
        this.target = new Vector3();

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
        this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

        // Mouse buttons
        this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

        // Touch fingers
        this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

        // for reset
        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.zoom0 = this.object instanceof OrthographicCamera ? this.object.zoom : 0;

        // the target DOM element for key events
        this._domElementKeyEvents = null;

        //
        this.domElement.addEventListener( 'contextmenu', this.onContextMenu );
        this.domElement.addEventListener( 'pointerdown', this.onPointerDown );
        this.domElement.addEventListener( 'pointercancel', this.onPointerUp );
        this.domElement.addEventListener( 'wheel', this.onMouseWheel, { passive: false } );

        // force an update at start
        this.update();
    }

    /**
     * Update the controls. Must be called after any manual changes to the camera's transform, or in the update loop if
     * .autoRotate or .enableDamping are set. `deltaTime`, in seconds, is optional, and is only required if you want the
     * auto-rotate speed to be independent of the frame rate (the refresh rate of the display).
     */
    // this method is exposed, but perhaps it would be better if we can make it private...
    public update(deltaTime?: number): boolean {
        const offset = new Vector3();

        // so camera.up is the orbit axis
        const quat = new Quaternion().setFromUnitVectors( this.object.up, new Vector3( 0, 1, 0 ) );
        const quatInverse = quat.clone().invert();

        const lastPosition = new Vector3();
        const lastQuaternion = new Quaternion();
        const lastTargetPosition = new Vector3();

        const twoPI = 2 * Math.PI;

        const position = this.object.position;

        offset.copy( position ).sub( this.target );

        // rotate offset to "y-axis-is-up" space
        offset.applyQuaternion( quat );

        // angle from z-axis around y-axis
        this.spherical.setFromVector3( offset );

        if ( this.autoRotate && this.state === STATE.NONE ) {
            this.rotateLeft( this.getAutoRotationAngle( deltaTime??null ) );
        }

        if ( this.enableDamping ) {
            this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
            this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
        } else {
            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;
        }

        // restrict theta to be between desired limits
        let min = this.minAzimuthAngle;
        let max = this.maxAzimuthAngle;

        if ( isFinite( min ) && isFinite( max ) ) {
            if ( min < - Math.PI ) { min += twoPI; } else if ( min > Math.PI ) { min -= twoPI; }
            if ( max < - Math.PI ) { max += twoPI; } else if ( max > Math.PI ) { max -= twoPI; }
            if ( min <= max ) {
                this.spherical.theta = Math.max( min, Math.min( max, this.spherical.theta ) );
            } else {
                this.spherical.theta = ( this.spherical.theta > ( min + max ) / 2 ) ?
                    Math.max( min, this.spherical.theta ) :
                    Math.min( max, this.spherical.theta );
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
        if ( this.zoomToCursor && this.performCursorZoom || this.object instanceof OrthographicCamera ) {
            this.spherical.radius = this.clampDistance( this.spherical.radius );
        } else {
            this.spherical.radius = this.clampDistance( this.spherical.radius * this.scale );
        }
        offset.setFromSpherical( this.spherical );

        // rotate offset back to "camera-up-vector-is-up" space
        offset.applyQuaternion( quatInverse );
        position.copy( this.target ).add( offset );
        this.object.lookAt( this.target );

        if ( this.enableDamping === true ) {
            this.sphericalDelta.theta *= ( 1 - this.dampingFactor );
            this.sphericalDelta.phi *= ( 1 - this.dampingFactor );
            this.panOffset.multiplyScalar( 1 - this.dampingFactor );
        } else {
            this.sphericalDelta.set( 0, 0, 0 );
            this.panOffset.set( 0, 0, 0 );
        }

        // adjust camera position
        let zoomChanged = false;
        if ( this.zoomToCursor && this.performCursorZoom ) {
            let newRadius = null;
            if ( this.object instanceof PerspectiveCamera ) {

                // move the camera down the pointer ray
                // this method avoids floating point error
                const prevRadius = offset.length();
                newRadius = this.clampDistance( prevRadius * this.scale );

                const radiusDelta = prevRadius - newRadius;
                this.object.position.addScaledVector( this.dollyDirection, radiusDelta );
                this.object.updateMatrixWorld();

            } else if ( this.object instanceof OrthographicCamera ) {

                // adjust the ortho camera position based on zoom changes
                const mouseBefore = new Vector3( this.mouse.x, this.mouse.y, 0 );
                mouseBefore.unproject( this.object );

                this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this.scale ) );
                this.object.updateProjectionMatrix();
                zoomChanged = true;

                const mouseAfter = new Vector3( this.mouse.x, this.mouse.y, 0 );
                mouseAfter.unproject( this.object );

                this.object.position.sub( mouseAfter ).add( mouseBefore );
                this.object.updateMatrixWorld();

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
                        .transformDirection( this.object.matrix )
                        .multiplyScalar( newRadius )
                        .add( this.object.position );
                } else {
                    // get the ray and translation plane to compute target
                    _ray.origin.copy( this.object.position );
                    _ray.direction.set( 0, 0, - 1 ).transformDirection( this.object.matrix );

                    // if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
                    // extremely large values
                    if ( Math.abs( this.object.up.dot( _ray.direction ) ) < TILT_LIMIT ) {
                        this.object.lookAt( this.target );
                    } else {
                        _plane.setFromNormalAndCoplanarPoint( this.object.up, this.target );
                        _ray.intersectPlane( _plane, this.target );
                    }
                }
            }
        } else if ( this.object instanceof OrthographicCamera ) {
            this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this.scale ) );
            this.object.updateProjectionMatrix();
            zoomChanged = true;
        }

        this.scale = 1;
        this.performCursorZoom = false;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8
        if ( zoomChanged ||
            lastPosition.distanceToSquared( this.object.position ) > this.EPS ||
            8 * ( 1 - lastQuaternion.dot( this.object.quaternion ) ) > this.EPS ||
            lastTargetPosition.distanceToSquared( this.target ) > 0 ) {

            this.dispatchEvent( this._event.change );

            lastPosition.copy( this.object.position );
            lastQuaternion.copy( this.object.quaternion );
            lastTargetPosition.copy( this.target );

            return true;
        }
        return false;
    }

    /**
     * Adds key event listeners to the given DOM element. `window`
     * is a recommended argument for using this method.
     * @param domElement
     */
    public listenToKeyEvents(domElement: HTMLElement | Window): void {
        domElement.addEventListener( 'keydown', this.onKeyDown as (event: Event) => void );
        this._domElementKeyEvents = domElement instanceof HTMLElement ? domElement : null;
    }

    /**
     * Removes the key event listener previously defined with {@link listenToKeyEvents}.
     */
    public stopListenToKeyEvents(): void {
        if (this._domElementKeyEvents) {
            this._domElementKeyEvents.removeEventListener( 'keydown', this.onKeyDown );
        }
        this._domElementKeyEvents = null;
    }

    /**
     * Save the current state of the controls. This can later be
     * recovered with .reset.
     */
    public saveState(): void {
        this.target0.copy( this.target );
        this.position0.copy( this.object.position );
        this.zoom0 =this.object instanceof OrthographicCamera ? this.object.zoom : 0;
    }

    /**
     * Reset the controls to their state from either the last time
     * the .saveState was called, or the initial state.
     */
    public reset(): void {

        this.target.copy( this.target0 );
        this.object.position.copy( this.position0 );
        if (this.object instanceof OrthographicCamera) { this.object.zoom = this.zoom0; }

        if (this.object instanceof PerspectiveCamera) {this.object.updateProjectionMatrix(); }
        this.dispatchEvent( this._event.change );

        this.update();

        this.state = STATE.NONE;
    }

    /**
     * Remove all the event listeners.
     */
    public dispose(): void {

        this.domElement.removeEventListener( 'contextmenu', this.onContextMenu as (event: Event) => void );

        this.domElement.removeEventListener( 'pointerdown', this.onPointerDown as (event: Event) => void );
        this.domElement.removeEventListener( 'pointercancel', this.onPointerUp as (event: Event) => void );
        this.domElement.removeEventListener( 'wheel', this.onMouseWheel as (event: Event) => void );

        this.domElement.removeEventListener( 'pointermove', this.onPointerMove as (event: Event) => void );
        this.domElement.removeEventListener( 'pointerup', this.onPointerUp as (event: Event) => void );

        if ( this._domElementKeyEvents !== null ) {
            this._domElementKeyEvents.removeEventListener( 'keydown', this.onKeyDown as (event: Event) => void );
            this._domElementKeyEvents = null;
        }
        //this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
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
    public getDistance(): number { return this.object.position.distanceTo( this.target ); }

    //
    // event callbacks - update the object state
    //
    private handleMouseDownRotate( event: MouseEvent ) { this.rotateStart.set( event.clientX, event.clientY ); }
    private handleMouseDownDolly( event: MouseEvent ) {
        this.updateMouseParameters( event );
        this.dollyStart.set( event.clientX, event.clientY );
    }
    private handleMouseDownPan( event: MouseEvent ) { this.panStart.set( event.clientX, event.clientY ); }
    private handleMouseMoveRotate( event: MouseEvent ) {
        this.rotateEnd.set( event.clientX, event.clientY );

        this.rotateDelta.subVectors( this.rotateEnd, this.rotateStart ).multiplyScalar( this.rotateSpeed );
        const clientHeight = this.domElement instanceof HTMLElement ? this.domElement.clientHeight : 1;        
        this.rotateLeft( 2 * Math.PI * this.rotateDelta.x / clientHeight ); // yes, height
        this.rotateUp( 2 * Math.PI * this.rotateDelta.y / clientHeight );
        this.rotateStart.copy( this.rotateEnd );

        this.update();
    }
    private handleMouseMoveDolly( event: MouseEvent ) {
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
    private handleMouseMovePan( event: MouseEvent ) {
        this.panEnd.set( event.clientX, event.clientY );

        this.panDelta.subVectors( this.panEnd, this.panStart ).multiplyScalar( this.panSpeed );
        this.pan( this.panDelta.x, this.panDelta.y );
        this.panStart.copy( this.panEnd );

        this.update();
    }
    private handleMouseWheel( event: WheelEvent ) {
        this.updateMouseParameters( event );

        if ( event.deltaY < 0 ) {
            this.dollyIn( this.getZoomScale() );
        } else if ( event.deltaY > 0 ) {
            this.dollyOut( this.getZoomScale() );
        }

        this.update();
    }
    private handleKeyDown( event: KeyboardEvent ) {
        let needsUpdate = false;
        const clientHeight = this.domElement instanceof HTMLElement ? this.domElement.clientHeight : 1;
        switch ( event.code ) {
            case this.keys.UP:
                if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                    this.rotateUp( 2 * Math.PI * this.rotateSpeed / clientHeight );
                } else {
                    this.pan( 0, this.keyPanSpeed );
                }
                needsUpdate = true;
                break;
            case this.keys.BOTTOM:
                if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                    this.rotateUp( - 2 * Math.PI * this.rotateSpeed / clientHeight );
                } else {
                    this.pan( 0, - this.keyPanSpeed );
                }
                needsUpdate = true;
                break;
            case this.keys.LEFT:
                if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                    this.rotateLeft( 2 * Math.PI * this.rotateSpeed / clientHeight );
                } else {
                    this.pan( this.keyPanSpeed, 0 );
                }
                needsUpdate = true;
                break;
            case this.keys.RIGHT:
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
    private handleTouchStartRotate() {
        if ( this.pointers.length === 1 ) {
            this.rotateStart.set( this.pointers[ 0 ].pageX, this.pointers[ 0 ].pageY );
        } else {
            const x = 0.5 * ( this.pointers[ 0 ].pageX + this.pointers[ 1 ].pageX );
            const y = 0.5 * ( this.pointers[ 0 ].pageY + this.pointers[ 1 ].pageY );
            this.rotateStart.set( x, y );
        }
    }
    private handleTouchStartPan() {
        if ( this.pointers.length === 1 ) {
            this.panStart.set( this.pointers[ 0 ].pageX, this.pointers[ 0 ].pageY );
        } else {
            const x = 0.5 * ( this.pointers[ 0 ].pageX + this.pointers[ 1 ].pageX );
            const y = 0.5 * ( this.pointers[ 0 ].pageY + this.pointers[ 1 ].pageY );
            this.panStart.set( x, y );
        }
    }
    private handleTouchStartDolly() {
        const dx = this.pointers[ 0 ].pageX - this.pointers[ 1 ].pageX;
        const dy = this.pointers[ 0 ].pageY - this.pointers[ 1 ].pageY;
        const distance = Math.sqrt( dx * dx + dy * dy );
        this.dollyStart.set( 0, distance );
    }
    private handleTouchStartDollyPan() {
        if ( this.enableZoom ) { this.handleTouchStartDolly(); }
        if ( this.enablePan ) { this.handleTouchStartPan(); }
    }
    private handleTouchStartDollyRotate() {
        if ( this.enableZoom ) { this.handleTouchStartDolly(); }
        if ( this.enableRotate ) { this.handleTouchStartRotate(); }
    }
    private handleTouchMoveRotate( event: PointerEvent ) {
        if ( this.pointers.length === 1 ) {
            this.rotateEnd.set( event.pageX, event.pageY );
        } else {
            const position = this.getSecondPointerPosition( event );
            const x = 0.5 * ( event.pageX + position.x );
            const y = 0.5 * ( event.pageY + position.y );
            this.rotateEnd.set( x, y );
        }

        this.rotateDelta.subVectors( this.rotateEnd, this.rotateStart ).multiplyScalar( this.rotateSpeed );
        const clientHeight = this.domElement instanceof HTMLElement ? this.domElement.clientHeight : 1;
        this.rotateLeft( 2 * Math.PI * this.rotateDelta.x / clientHeight ); // yes, height
        this.rotateUp( 2 * Math.PI * this.rotateDelta.y / clientHeight );
        this.rotateStart.copy( this.rotateEnd );
    }
    private handleTouchMovePan( event: PointerEvent ) {
        if ( this.pointers.length === 1 ) {
            this.panEnd.set( event.pageX, event.pageY );
        } else {
            const position = this.getSecondPointerPosition( event );
            const x = 0.5 * ( event.pageX + position.x );
            const y = 0.5 * ( event.pageY + position.y );
            this.panEnd.set( x, y );
        }

        this.panDelta.subVectors( this.panEnd, this.panStart ).multiplyScalar( this.panSpeed );
        this.pan( this.panDelta.x, this.panDelta.y );
        this.panStart.copy( this.panEnd );
    }
    private handleTouchMoveDolly( event: PointerEvent ) {
        const position = this.getSecondPointerPosition( event );
        const dx = event.pageX - position.x;
        const dy = event.pageY - position.y;
        const distance = Math.sqrt( dx * dx + dy * dy );
        this.dollyEnd.set( 0, distance );

        this.dollyDelta.set( 0, Math.pow( this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed ) );
        this.dollyOut( this.dollyDelta.y );
        this.dollyStart.copy( this.dollyEnd );
    }
    private handleTouchMoveDollyPan( event: PointerEvent ) {
        if ( this.enableZoom ) { this.handleTouchMoveDolly( event ); }
        if ( this.enablePan ) { this.handleTouchMovePan( event ); }
    }
    private handleTouchMoveDollyRotate( event: PointerEvent ) {
        if ( this.enableZoom ) { this.handleTouchMoveDolly( event ); }
        if ( this.enableRotate ) { this.handleTouchMoveRotate( event ); }
    }

    //
    // event handlers - FSM: listen for events and reset state
    //
    private onPointerDown( event: PointerEvent ) {
        if ( this.enabled === false ) {
            return;
        }
        if ( this.pointers.length === 0 ) {
            if (this.domElement instanceof HTMLElement) {
                this.domElement.setPointerCapture( event.pointerId );
            }
            this.domElement.addEventListener( 'pointermove', this.onPointerMove as (event: Event) => void );
            this.domElement.addEventListener( 'pointerup', this.onPointerUp as (event: Event) => void );
        }

        //
        this.addPointer( event );
        if ( event.pointerType === 'touch' ) {
            this.onTouchStart( event );
        } else {
            this.onMouseDown( event );
        }
    }
    private onPointerMove( event: PointerEvent ) {
        if ( this.enabled === false ) { return; }
        if ( event.pointerType === 'touch' ) {
            this.onTouchMove( event );
        } else {
            this.onMouseMove( event );
        }
    }
    private onPointerUp( event: PointerEvent ) {
        this.removePointer( event as PointerEvent );

        if ( this.pointers.length === 0 ) {
            if (this.domElement instanceof HTMLElement) {
                this.domElement.releasePointerCapture( event.pointerId );
            }

            this.domElement.removeEventListener( 'pointermove', this.onPointerMove as (event: Event) => void );
            this.domElement.removeEventListener( 'pointerup', this.onPointerUp as (event: Event) => void );
        }
        this.dispatchEvent( this._event.end );
        this.state = STATE.NONE;
    }
    private onMouseDown( event: MouseEvent ) {
        let mouseAction;
        switch ( event.button ) {
            case 0:     mouseAction = this.mouseButtons.LEFT;   break;
            case 1:     mouseAction = this.mouseButtons.MIDDLE; break;
            case 2:     mouseAction = this.mouseButtons.RIGHT;  break;
            default:    mouseAction = - 1;                      break;
        }
        switch ( mouseAction ) {
            case MOUSE.DOLLY:
                if ( this.enableZoom === false ) { return; }
                this.handleMouseDownDolly( event );
                this.state = STATE.DOLLY;
                break;
            case MOUSE.ROTATE:
                if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                    if ( this.enablePan === false ) { return; }
                    this.handleMouseDownPan( event );
                    this.state = STATE.PAN;
                } else {
                    if ( this.enableRotate === false ) { return; }
                    this.handleMouseDownRotate( event );
                    this.state = STATE.ROTATE;
                }
                break;
            case MOUSE.PAN:
                if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
                    if ( this.enableRotate === false ) { return; }
                    this.handleMouseDownRotate( event );
                    this.state = STATE.ROTATE;
                } else {
                    if ( this.enablePan === false ) { return; }
                    this.handleMouseDownPan( event );
                    this.state = STATE.PAN;
                }
                break;
            default:
                this.state = STATE.NONE;
                break;
        }
        if ( this.state !== STATE.NONE ) {
            this.dispatchEvent( this._event.start );
        }
    }
    private onMouseMove( event: MouseEvent ) {
        switch ( this.state ) {
            case STATE.ROTATE:
                if ( this.enableRotate === false ) { return; }
                this.handleMouseMoveRotate( event );
                break;
            case STATE.DOLLY:
                if ( this.enableZoom === false ) { return; }
                this.handleMouseMoveDolly( event );
                break;
            case STATE.PAN:
                if ( this.enablePan === false ) { return; }
                this.handleMouseMovePan( event );
                break;
        }
    }
    private onMouseWheel( event: WheelEvent ) {
        if ( this.enabled === false || this.enableZoom === false || this.state !== STATE.NONE ) { return; }
        event.preventDefault();
        this.dispatchEvent( this._event.start );
        this.handleMouseWheel( event );
        this.dispatchEvent( this._event.end );
    }
    private onKeyDown( event: KeyboardEvent ) {
        if ( this.enabled === false || this.enablePan === false ) { return; }
        this.handleKeyDown( event );
    }
    private onTouchStart( event: PointerEvent ) {
        this.trackPointer( event );
        switch ( this.pointers.length ) {
            case 1:
                switch ( this.touches.ONE ) {
                    case TOUCH.ROTATE:
                        if ( this.enableRotate === false ) { return; }
                        this.handleTouchStartRotate();
                        this.state = STATE.TOUCH_ROTATE;
                        break;
                    case TOUCH.PAN:
                        if ( this.enablePan === false ) { return; }
                        this.handleTouchStartPan();
                        this.state = STATE.TOUCH_PAN;
                        break;
                    default:
                        this.state = STATE.NONE;
                        break;
                }
                break;
            case 2:
                switch ( this.touches.TWO ) {
                    case TOUCH.DOLLY_PAN:
                        if ( this.enableZoom === false && this.enablePan === false ) { return; }
                        this.handleTouchStartDollyPan();
                        this.state = STATE.TOUCH_DOLLY_PAN;
                        break;
                    case TOUCH.DOLLY_ROTATE:
                        if ( this.enableZoom === false && this.enableRotate === false ) { return; }
                        this.handleTouchStartDollyRotate();
                        this.state = STATE.TOUCH_DOLLY_ROTATE;
                        break;
                    default:
                        this.state = STATE.NONE;
                        break;
                }
                break;
            default:
                this.state = STATE.NONE;
                break;
        }
        if ( this.state !== STATE.NONE ) {
            this.dispatchEvent( this._event.start );
        }
    }
    private onTouchMove( event: PointerEvent ) {
        this.trackPointer( event );
        switch ( this.state ) {
            case STATE.TOUCH_ROTATE:
                if ( this.enableRotate === false ) { return; }
                this.handleTouchMoveRotate( event );
                this.update();
                break;
            case STATE.TOUCH_PAN:
                if ( this.enablePan === false ) { return; }
                this.handleTouchMovePan( event );
                this.update();
                break;
            case STATE.TOUCH_DOLLY_PAN:
                if ( this.enableZoom === false && this.enablePan === false ) { return; }
                this.handleTouchMoveDollyPan( event );
                this.update();
                break;
            case STATE.TOUCH_DOLLY_ROTATE:
                if ( this.enableZoom === false && this.enableRotate === false ) { return; }
                this.handleTouchMoveDollyRotate( event );
                this.update();
                break;
            default:
                this.state = STATE.NONE;
                break;
        }
    }
    private onContextMenu( event: MouseEvent ) {
        if ( this.enabled === false ) { return; }
        event.preventDefault();
    }
    private addPointer( event: PointerEvent ) {
        this.pointers.push( event );
    }
    private removePointer( event: PointerEvent ) {
        delete this.pointerPositions[ event.pointerId ];

        for ( let i = 0; i < this.pointers.length; i ++ ) {
            if ( this.pointers[ i ].pointerId === event.pointerId ) {
                this.pointers.splice( i, 1 );
                return;
            }
        }
    }
    private trackPointer( event: PointerEvent ) {
        let position = this.pointerPositions[ event.pointerId ];
        if ( position === undefined ) {
            position = new Vector2();
            this.pointerPositions[ event.pointerId ] = position;
        }
        position.set( event.pageX, event.pageY );
    }
    private getSecondPointerPosition( event: PointerEvent ) {
        const pointer = ( event.pointerId === this.pointers[ 0 ].pointerId ) ? this.pointers[ 1 ] : this.pointers[ 0 ];
        return this.pointerPositions[ pointer.pointerId ];
    }

    private getAutoRotationAngle( deltaTime: number | null ) {
        if ( deltaTime !== null ) {
            return ( 2 * Math.PI / 60 * this.autoRotateSpeed ) * deltaTime;
        } else {
            return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
        }
    }
    private getZoomScale() { return Math.pow( 0.95, this.zoomSpeed ); }
    private rotateLeft( angle: number ) { this.sphericalDelta.theta -= angle; }
    private rotateUp( angle: number ) { this.sphericalDelta.phi -= angle; }
    private panLeft( distance: number, objectMatrix: Matrix4 ) {
        const v = new Vector3();
        v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
        v.multiplyScalar( - distance );
        this.panOffset.add( v );
    }
    private panUp( distance: number, objectMatrix: Matrix4 ) {
        const v = new Vector3();

        if ( this.screenSpacePanning === true ) {
            v.setFromMatrixColumn( objectMatrix, 1 );
        } else {
            v.setFromMatrixColumn( objectMatrix, 0 );
            v.crossVectors( this.object.up, v );
        }
        v.multiplyScalar( distance );
        this.panOffset.add( v );
    }
    // deltaX and deltaY are in pixels; right and down are positive
    private pan( deltaX: number, deltaY: number ) {
        const offset = new Vector3();
        const clientWidth = this.domElement instanceof HTMLElement ? this.domElement.clientWidth : 1;
        const clientHeight = this.domElement instanceof HTMLElement ? this.domElement.clientHeight : 1;
        if ( this.object instanceof PerspectiveCamera ) {

            // perspective
            const position = this.object.position;
            offset.copy( position ).sub( this.target );
            let targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan( ( this.object.fov / 2 ) * Math.PI / 180.0 );

            // we use only clientHeight here so aspect ratio does not distort speed
            this.panLeft( 2 * deltaX * targetDistance / clientHeight, this.object.matrix );
            this.panUp( 2 * deltaY * targetDistance / clientHeight, this.object.matrix );

        } else if ( this.object instanceof OrthographicCamera ) {

            // orthographic
            this.panLeft( deltaX * ( this.object.right - this.object.left ) / this.object.zoom / clientWidth, this.object.matrix );
            this.panUp( deltaY * ( this.object.top - this.object.bottom ) / this.object.zoom / clientHeight, this.object.matrix );
        } else {
            // camera neither orthographic nor perspective
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
            this.enablePan = false;
        }
    }
    private dollyOut( dollyScale: number ) {
        if ( this.object instanceof PerspectiveCamera || this.object instanceof OrthographicCamera ) {
            this.scale /= dollyScale;
        } else {
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
            this.enableZoom = false;
        }
    }
    private dollyIn( dollyScale: number ) {
        if ( this.object instanceof PerspectiveCamera || this.object instanceof OrthographicCamera ) {
            this.scale *= dollyScale;
        } else {
            console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
            this.enableZoom = false;
        }
    }
    private updateMouseParameters( event: MouseEvent ) {
        if ( ! this.zoomToCursor ) { return; }

        this.performCursorZoom = true;

        const rect = this.domElement instanceof HTMLElement ? this.domElement.getBoundingClientRect() : new DOMRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        this.mouse.x = ( x / w ) * 2 - 1;
        this.mouse.y = - ( y / h ) * 2 + 1;

        this.dollyDirection.set( this.mouse.x, this.mouse.y, 1 ).unproject( this.object ).sub( this.object.position ).normalize();
    }
    private clampDistance( dist: number ) { return Math.max( this.minDistance, Math.min( this.maxDistance, dist ) ); }
}
