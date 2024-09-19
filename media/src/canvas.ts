import * as THREE from 'three';
//import WebGPU from 'three/examples/jsm/capabilities/WebGPU.js';
//import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
//import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
//import StorageInstancedBufferAttribute from 'three/examples/jsm/renderers/common/Buffer.js';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';

import { OrbitControls } from './OrbitControls';
import { WalkThroughControls } from './WalkThroughControls';
import { ControlsBase } from './ControlsBase';

import * as SYMBOL from './symbol';

/** 座標 */
class Coodinate {
    constructor(public readonly x: number, public readonly y: number, public readonly z: number) {}
}
/** 位置 */
export class Location extends Coodinate {}
/** 距離 */
export class Distance extends Coodinate {}
/** 回転 */
export class Quaternion extends Coodinate {
    constructor(x: number, y: number, z: number, public readonly w: number) {
        super(x, y, z);
    }
}
/** 見ている位置と方向 */
export class Looking {
    constructor(public readonly position: Location, public readonly quaternion: Quaternion) {}
}

/** 表示モデル */
class ViewModel {
    public readonly size: Distance;
    public constructor(world: CANNON.World, scene: THREE.Scene, size: Distance) {
        this.size = size;
    }
    public copy(): void {}
}
/** 地面モデル */
class GroundModel extends ViewModel {
    public readonly material: CANNON.Material;
    private readonly _body: CANNON.Body;
    private readonly _mesh: THREE.Mesh;
    public constructor(world: CANNON.World, scene: THREE.Scene, public readonly size: Distance, checkColor: THREE.Color, checkMeter: number) {
        super(world, scene, size);
        // 地面を追加
        this.material = new CANNON.Material({
            restitution: 0.5,   // 反発係数
        });
        this._body = new CANNON.Body({
            mass: 0, // 質量ゼロKg
            shape: new CANNON.Box(
                new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2), // 薄い箱
            ),
            material: this.material,
            position: new CANNON.Vec3(0, 0, 0),
            collisionResponse: true,    // 衝突
        });
        world.addBody(this._body);

        //床の描画
        const count = size.x / checkMeter;
        const width = 2;
        const bytes = Math.pow(width, 2);
        const data = new Uint8Array(bytes * 4);
        for (let y = 0; y < width; y++) {
            for (let x = 0; x < width; x++) {
                const index = (x * y) * 4;
                data[index + 0] = checkColor.r * 256;   // Red
                data[index + 1] = checkColor.g * 256;   // Green
                data[index + 2] = checkColor.b * 256;   // Blue
                data[index + 3] = 256;//x === y ? 256 : 128;  // Alpha
            }
        }
        const texture = new THREE.DataTexture(data, width, width, THREE.RGBAFormat, THREE.UnsignedByteType);
        texture.repeat.set(count / 2, count / 2);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
//        texture.magFilter = THREE.NearestFilter;
        texture.needsUpdate = true;//必ず必要

        // 地面を作成
        this._mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.MeshPhongMaterial({
                color: checkColor,////
////                map: texture,
////                side: THREE.DoubleSide,
//                transparent: true, opacity: 0.5,    // 透明度
                fog: true,
            }),
        );
        this._mesh.receiveShadow = true;
        this._mesh.castShadow = true;
        scene.add(this._mesh);
    }
    copy(): void {
        this._mesh.position.set(this._body.position.x, this._body.position.y, this._body.position.z);
        this._mesh.quaternion.set(this._body.quaternion.x, this._body.quaternion.y, this._body.quaternion.z, this._body.quaternion.w);
    }
}
/** シンボルモデル */
class SymbolModel extends ViewModel {
    //public readonly position: Location;
    public readonly symbol: SYMBOL.Symbol;
    public readonly material: CANNON.Material;
    public readonly _body: CANNON.Body;
    public readonly _mesh: THREE.Mesh;
    public constructor(world: CANNON.World, scene: THREE.Scene, symbol: SYMBOL.Symbol, size: Distance, position: Location, color?: string | number) {
        super(world, scene, size);
        this.symbol = symbol;
        const realPosition = symbol.position ? symbol.position : position;
        const realQuaternion = symbol.quaternion ? symbol.quaternion : new SYMBOL.Quaternion(0, 0, 0, 0);

        // 実体を生成
        this.material = new CANNON.Material({
            restitution: 0.5,   // 反発係数
        });
        const thickness = 0.1; // 厚み 1mm
        const density = 1;   // 水の密度: 1 g/mm3
        const kiro = 1000;
        const volume = size.x * size.y * size.z;
        this._body = new CANNON.Body({
            mass: (density * volume) / kiro, // 質量Kg
            material: this.material,
            position: new CANNON.Vec3(realPosition.x, realPosition.y, realPosition.z),
            quaternion: new CANNON.Quaternion(realQuaternion.x, realQuaternion.y, realQuaternion.z, realQuaternion.w),
            collisionResponse: true,    // 衝突
        });
        const shapeX = new CANNON.Box(new CANNON.Vec3(thickness / 2, size.y / 2, size.z / 2));
        const shapeY = new CANNON.Box(new CANNON.Vec3(size.x / 2, thickness / 2, size.z / 2));
        const shapeZ = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, thickness / 2));
        this._body.addShape(shapeX, new CANNON.Vec3(0 + (size.x / 2) - (thickness / 2), 0, 0));
        this._body.addShape(shapeX, new CANNON.Vec3(0 - (size.x / 2) - (thickness / 2), 0, 0));
        this._body.addShape(shapeY, new CANNON.Vec3(0, 0 + (size.y / 2) - (thickness / 2), 0));
        this._body.addShape(shapeY, new CANNON.Vec3(0, 0 - (size.y / 2) - (thickness / 2), 0));
        this._body.addShape(shapeZ, new CANNON.Vec3(0, 0, 0 + (size.z / 2) - (thickness / 2)));
        this._body.addShape(shapeZ, new CANNON.Vec3(0, 0, 0 - (size.z / 2) - (thickness / 2)));
        world.addBody(this._body);

        // 外観を生成
        this._mesh = new THREE.Mesh(
            //new THREE.SphereGeometry(Math.max(size.x, size.y, size.z) / 2), // 球
            new THREE.BoxGeometry(size.x, size.y, size.z),  // 立方体
            new THREE.MeshPhongMaterial({
                color: color,
                envMap: null,           // テクスチャ
                refractionRatio: 0.98,  // 屈折率
                reflectivity: 0.1,        // 映り込み
                transparent: true, opacity: 0.8,    // 透明度
                //emissive:0x000000, //影色
                //shininess:100, //光沢度合い（～100）
                //specular:0x696969 //光沢部の色
            })
        );
        this._mesh.receiveShadow = true;
        this._mesh.castShadow = true;
        scene.add(this._mesh);
    }
    public copy(): void {
        this._mesh.position.set(this._body.position.x, this._body.position.y, this._body.position.z);
        this._mesh.quaternion.set(this._body.quaternion.x, this._body.quaternion.y, this._body.quaternion.z, this._body.quaternion.w);
    }
}

/** 表示イベント */
export interface ViewEventMap {
    debugLog:   { type: 'debugLog'; message: string; };
    moveCamera: { type: 'moveCamera'; looking: Looking; };
    saveSymbol: { type: 'saveSymbol'; symbol: SYMBOL.Symbol; };
}

/** @class 表示 */
export class View extends THREE.EventDispatcher<ViewEventMap> {
    private readonly _renderer: THREE.Renderer;
    private readonly _world: CANNON.World;
    private readonly _scene: THREE.Scene;
    private readonly _camera: THREE.Camera;
    private readonly _ground: GroundModel;
    private _objects: SymbolModel[] = [];
    private _symbol: SYMBOL.Symbol = new SYMBOL.Symbol(SYMBOL.SymbolKind.Null, 'null', '', 1, 1);
    private _symbolsBox = new THREE.Box3();


    private _controls: ControlsBase;
    private _saveInterval: NodeJS.Timeout | null = null;

	/** @constructor
	 * @param canvas    Webキャンバス
	 * @param width	    Webキャンバスの幅
	 * @param height    Webキャンバスの高さ
	 */
    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        super();

        // 描画機を作成
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
        renderer.setClearColor(0x000000, 0); // default
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        this._renderer = renderer;

        // 世界を作成
        this._world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0),
        });
        // 空間を作成
        this._scene = new THREE.Scene();
        // 地面を追加
        this._ground = new GroundModel(this._world, this._scene, new Distance(5000, 10, 5000), new THREE.Color('lightgreen'), 10);
        // カメラの生成
        this._camera = new THREE.PerspectiveCamera(45, width / height, 0.1, this._ground.size.x);

        // コントローラの生成
        //this._controls = new OrbitControls(this._camera, this._renderer.domElement);
        this._controls = new WalkThroughControls(this._camera, this._renderer.domElement);
        this._controls.target.set(0, 0, 0);
        this._controls.update();
        // カメラの移動イベント
        this._controls.addEventListener('change', () => {
            // カメラの移動制限: 地面の下には行けない
            this._camera.position.y = this._camera.position.y > 0 ? this._camera.position.y : 0;
            // カメラ位置を保存
            this.dispatchEvent({ type: 'moveCamera', looking: new Looking(
                new Location(this._camera.position.x, this._camera.position.y, this._camera.position.z),
                new Quaternion(this._camera.quaternion.x, this._camera.quaternion.y, this._camera.quaternion.z, this._camera.quaternion.w)
                ) });
        });
        this._controls.addEventListener('debug', (event) => { this.dispatchEvent({ type: 'debugLog', message: event.message }); });
    }

	/** @function 破棄 */
	public dispose() {
        // イベントを削除
        if (this._saveInterval) { clearInterval(this._saveInterval); }

		// 関連リソースを破棄
        this._objects.forEach(obj => {
            this._scene.remove(obj._mesh);
            this._world.removeBody(obj._body);
        });
        this._objects = [];

        // 制御を破棄
        this._controls.dispose();
	}

	/** @function サイズ変更
     * @param width     ウィンドウの幅
     * @param height    ウィンドウの高さ
     */
    public resize(width: number, height: number) {
        this._controls.resize(width / height);
        this._renderer.setSize(width, height);
    }

    /** カメラが見ている位置と方向の再現
     * @param looking 見ている位置と方向
    */
    public restoreCamera(looking: Looking) {
        this._camera.position.set(looking.position.x, looking.position.y, looking.position.z);
        this._camera.quaternion.set(looking.quaternion.x, looking.quaternion.y, looking.quaternion.z, looking.quaternion.w);
    }

    // カメラを全体が見える位置
    public centerCamera(): Location {
        const boxCenter = new THREE.Vector3();
        const boxSize = new THREE.Vector3();
        this._symbolsBox.getCenter(boxCenter);
        this._symbolsBox.getSize(boxSize);
        this.dispatchEvent({ type: 'debugLog', message: `showSymbolTree(camera) center(${boxCenter.x},${boxCenter.y},${boxCenter.z}) size(${boxSize.x},${boxSize.y},${boxSize.z})` });
        return new Location(
            boxCenter.x,
            boxCenter.y, //200 * 100;
            1.5 * Math.max(boxSize.x, boxSize.y, boxSize.z)
        );
    }

    // カメラを移動する
    public cameraMove(position: Location): void {
        this._camera.position.set(position.x, position.y, position.z);
    }

    /** 光あれ */
    public letThereBeLight() {

        // 光源を作成
        const directionalLight = new THREE.DirectionalLight('white');//PointLight('white');
        directionalLight.castShadow = true;
        directionalLight.position.set(this._ground.size.x, this._ground.size.x, this._ground.size.z);
        this._scene.add(directionalLight);

        // 環境光を作成
        const ambientLight = new THREE.AmbientLight('white');
        this._scene.add(ambientLight);
    }

    /** 行数から立方体の大きさを求める 1行=1mm */
    private _cubeSizeByLineCount(lineCount: number): Distance {
        const cm = lineCount / 10;
        return new Distance(cm, cm, cm);
    }

    private _symbolTreeStopRequest: boolean = false;
    private _symbolTreeIsMaking: boolean = false;

    /** シンボル木の表示 */
    public showSymbolTree(symbolText: string, operation: string): void {
        const symbol = symbolText.length > 0 ? JSON.parse(symbolText) as SYMBOL.Symbol : null;
        if (symbol) {
            // シンボル木の作成完了を待つ
            if (this._symbolTreeIsMaking) {
                this._symbolTreeStopRequest = true;
                while (this._symbolTreeIsMaking) {}
            }

            // シンボルの再構成
            this._symbol = new SYMBOL.Symbol(symbol.kind, symbol.name, symbol.filename, symbol.startLine, symbol.endLine,
                symbol.updateId, symbol.position, symbol.quaternion);
            symbol.children.forEach(child => {
                const childSymbol = new SYMBOL.Symbol(child.kind, child.name, child.filename, child.startLine, child.endLine,
                    symbol.updateId, child.position, child.quaternion);
                this._symbol.addChild(childSymbol);
            });
            const axes = new THREE.AxesHelper();

            const force = 1; //1_000_000;//10 * 1000 * 1000 * 1000 * 1000;   // 剛性(変形し易さ) 0-1_000_000
            const ancorRadius = 10;

            // オブジェクトのサンプルを生成
            ////this._createObjectSample(force, ancorRadius);

            // ファイル赤球を生成
            const fileSize = this._cubeSizeByLineCount(this._symbol.lineCount);
            let currentY = fileSize.y * 3.5;
            let previousBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, currentY, 0) });
            const filerMesh = new THREE.Mesh(
                new THREE.SphereGeometry(ancorRadius),
                new THREE.MeshPhongMaterial({ color: 'red', transparent: true, opacity: 0.5 })
            );
            filerMesh.position.set(0, currentY, 0);
            this._scene.add(filerMesh);
            currentY -= ancorRadius + (ancorRadius / 4);
            this._symbolsBox.expandByObject(filerMesh);

            // シンボル木を生成
            this.dispatchEvent({ type: 'debugLog', message: `showSymbolTree(BEGIN)` });
            let previousUnder = -ancorRadius;
            this._symbolTreeIsMaking = true;
            for (let child of this._symbol.children) {
                if (this._symbolTreeStopRequest) { break; }

                // シンボル箱を作成
                const size = this._cubeSizeByLineCount(child.lineCount < 50 ? 50 : child.lineCount);
                const position = new Location(0, currentY - (size.y / 2), 0);
                const color = this._convertSymbolKindToColor(child.kind);
                const cube = new SymbolModel(this._world, this._scene, child, size, position, color);
                this._objects.push(cube);
                this._symbolsBox.expandByObject(cube._mesh);

/*
                // シンボル箱と地面の接触
                const contactMaterial = new CANNON.ContactMaterial(cube.material, this._ground.material, {
                    friction: 1,//0.5,                  // 摩擦係数
                    contactEquationStiffness: force,    // 剛性(変形し易さ)
                });
                this._world.addContactMaterial(contactMaterial);
*/
                // 前のシンボル箱とバネで繋ぐ
                const contactSpling = new CANNON.Spring(previousBody, cube._body, {
                    restLength: previousBody.position.y - cube._body.position.y, // 自然長（何も力が加わっていないときのスプリングの長さ）
                    stiffness: 100,    // スプリングの剛性(硬さ) 100:柔らかい-1000:硬い
                    damping: 1,         // 減衰係数(振動がどのくらい早く減少するか) 0:遅い-1:早い
                    localAnchorA: new CANNON.Vec3(0, -1, 0), // ボディAのアンカー（接続点）
                    localAnchorB: new CANNON.Vec3(0, 1, 0) // ボディBのアンカー（接続点）
                });
                // スプリングの力を適用
                this._world.addEventListener('preStep', function() {
                    contactSpling.applyForce();
                });

                // 前のシンボル箱と接続
                const constraint = new CANNON.DistanceConstraint(previousBody, cube._body, previousBody.position.y - cube._body.position.y);
                constraint.collideConnected = false;    // 衝突接続なし
                //constraint.stiffness = 100;  // バネの硬さ
                //constraint.relaxation = 4;   // 緩和係数
                this._world.addConstraint(constraint);

                // 前のシンボル箱を更新
                previousBody = cube._body;
                currentY -= size.y + (size.y / 4);
                previousUnder =  -((size.y / 2) + (size.y / 2));
            }
            this._symbolTreeIsMaking = false;
            this.dispatchEvent({ type: 'debugLog', message: `showSymbolTree(END)` });
        }
    }

    // シンボルの色を返す
    private _convertSymbolKindToColor(kind: SYMBOL.SymbolKind): string {
        let color = '';
        switch (kind) {
            case SYMBOL.SymbolKind.Function:    color ='magenta';   break;
            case SYMBOL.SymbolKind.Method:      color ='magenta';   break;
            case SYMBOL.SymbolKind.Property:    color ='white';     break;
            case SYMBOL.SymbolKind.Class:       color ='orange';    break;
            case SYMBOL.SymbolKind.Variable:    color ='cyan';      break;
            default:                            color ='gray';      break;
        }
        return color;
    }

    // オブジェクトのサンプルを生成
    private _createObjectSample(force: number, ancorRadius: number) {

        // アンカーを生成
        const ancorPosition = new Location(500, 300, 0);
        const ancorBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(ancorPosition.x, ancorPosition.y, ancorPosition.z) });
        const ancorMesh = new THREE.Mesh(new THREE.SphereGeometry(ancorRadius), new THREE.MeshPhongMaterial({ color: 'red', transparent: true, opacity: 0.5 }));
        ancorMesh.position.set(ancorPosition.x, ancorPosition.y, ancorPosition.z);
        this._scene.add(ancorMesh);

        // 1つ目のシンボルを生成
        const symbolFirst = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'first', '', 0, 80 - 1);
        const sizeFirst = this._cubeSizeByLineCount(symbolFirst.lineCount < 50 ? 50 : symbolFirst.lineCount);
        const cubeFirst = new SymbolModel(this._world, this._scene, symbolFirst, sizeFirst, new Location(500, 250, 0), 'gray');
        this._objects.push(cubeFirst);
        /*const constraintFirst = new CANNON.PointToPointConstraint(
            ancorBody,          new CANNON.Vec3(0, -(ancorRadius + (ancorRadius / 1)), 0),            // ワールド座標の接続点
            cubeFirst._body,    new CANNON.Vec3(0, (cubeFirst.size.y / 2) + (cubeFirst.size.y / 2), 0),    // 図形の中心からの接続点
            force
        );
        const constraintFirst = new CANNON.LockConstraint(ancorBody, cubeFirst._body);*/
        const constraintFirst = new CANNON.DistanceConstraint(ancorBody, cubeFirst._body, ancorBody.position.y - cubeFirst._body.position.y);
        this._world.addConstraint(constraintFirst);

        // 2つ目のシンボルを生成
        const symbolSecond = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'second', '', 80, 80 + 500 - 1);
        const sizeSecond = this._cubeSizeByLineCount(symbolSecond.lineCount < 50 ? 50 : symbolSecond.lineCount);
        const positionSecond = new Location(500, 200, 0);
        const cubeSecond = new SymbolModel(this._world, this._scene, symbolSecond, sizeSecond, positionSecond, 'gray');
        this._objects.push(cubeSecond);
        const symbolInner = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'second', '', 80 + 500, (80 + 500) + 200 - 1);
        const sizeInner = this._cubeSizeByLineCount(symbolInner.lineCount < 50 ? 50 : symbolInner.lineCount);
        const cubeInner = new SymbolModel(this._world, this._scene, symbolInner, sizeInner, positionSecond, 'red');
        this._objects.push(cubeInner);
        /*const constraintSecond = new CANNON.PointToPointConstraint(
            cubeFirst._body,    new CANNON.Vec3(0, -((cubeFirst.size.y / 2) + (cubeFirst.size.y / 2)), 0), // ワールド座標の接続点
            cubeSecond._body,   new CANNON.Vec3(0, (cubeSecond.size.y / 2) + (cubeSecond.size.y / 2), 0),   // 図形の中心からの接続点
            force
        );
        const constraintSecond = new CANNON.LockConstraint(cubeFirst._body, cubeSecond._body);*/
        const constraintSecond = new CANNON.DistanceConstraint(cubeFirst._body, cubeSecond._body, cubeFirst._body.position.y - cubeSecond._body.position.y);
        this._world.addConstraint(constraintSecond);
    }

    /** 世界を生かす */
    public animateWorld() {
        
        // 世界を動かす
        this._renderer.render(this._scene, this._camera);
        const cannonDebugger = CannonDebugger(this._scene, this._world, {});
        const animate = () => {

            // 物理計算結果を物に適用する
            this._ground.copy();
            this._objects.forEach(obj => obj.copy());

            // 世界を描画する
            this._world.fixedStep(); // framerate every 1 / 60 ms
            //cannonDebugger.update();
            this._renderer.render(this._scene, this._camera);
            requestAnimationFrame(animate);
        };
        animate();

        // 世界を保存する
        this._saveInterval = setInterval(() => {
            this._objects.forEach(obj => {

                // メッシュの位置を保存する
                const position = obj._mesh.position;
                obj.symbol.setPosition(position.x, position.y, position.z);

                // メッシュの回転を保存する
                const quaternion = obj._mesh.quaternion;
                obj.symbol.setQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
            });

            // シンボルを保存するs
            this._symbol.updateId = new Date().toISOString();
            this.dispatchEvent( { type: 'saveSymbol', symbol: this._symbol } );
        }, 1000);
    }

    /** ポイント位置のシンボルを探す
     * @param pointerX  ポインタのX位置
     * @param pointerY  ポインタのY位置
     * @param callbackFound 見つかった場合のコールバック
     */
    public findPointingSymbol(pointerX: number, pointerY: number, callbackFound: (symbol: SYMBOL.Symbol) => void) {

        // ポイント位置のメッシュを探す
        const pointer = new THREE.Vector2(pointerX, pointerY);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, this._camera);
        const meshs = raycaster.intersectObjects(this._scene.children);
        if (meshs.length > 0) {
            
            // 一番手前のメッシュからシンボルを特定する
            const clickMesh = meshs[0].object;
            const clickObjects = this._objects.filter(object => object._mesh.id === clickMesh.id);
            clickObjects.forEach(clickObject => {
                callbackFound(clickObject.symbol);
            });
        }
    }
}
