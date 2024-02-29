import * as THREE from 'three';
//import { OrbitControls } from 'three-orbitcontrols-ts'; // Sandbox ではズームできない。
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import * as SYMBOL from './symbol';

class Vector {
    constructor(public readonly x: number, public readonly y: number, public readonly z: number) {}
}
export class Location extends Vector{}
export class Distance extends Vector{}

class ViewObject {
    public readonly size: Distance;
    public constructor(world: CANNON.World, scene: THREE.Scene, size: Distance) {
        this.size = size;
    }
    public copy(): void {}
}

class Ground extends ViewObject {
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
            //collisionResponse: true,    // 衝突
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
        /////console.log(`check: ${checkMeter} meter ${count} count ${checkColor.r * 256},${checkColor.g * 256},${checkColor.b * 256}`);
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
class Cube extends ViewObject {
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
        const volume = ((size.x * kiro) * (size.y * kiro) * (size.z * kiro)) / kiro;
        /////console.log(`${symbol.name} line: ` + symbol.lineCount + ' / 1000 = volume:' + volume + ' -> meter:' + size.x + ' mass:' + (density * volume) / kiro);
        this._body = new CANNON.Body({
            mass: (density * volume) / kiro / kiro, // 質量Kg
            material: this.material,
            position: new CANNON.Vec3(realPosition.x, realPosition.y, realPosition.z),
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
            new THREE.BoxGeometry(size.x, size.y, size.z),
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
        //this._mesh.position.set(realPosition.x, realPosition.y, realPosition.z);
        //this._mesh.quaternion.set(realQuaternion.x, realQuaternion.y, realQuaternion.z, realQuaternion.w);
        this._mesh.receiveShadow = true;
        this._mesh.castShadow = true;
        scene.add(this._mesh);
    }
    public copy(): void {
        this._mesh.position.set(this._body.position.x, this._body.position.y, this._body.position.z);
        this._mesh.quaternion.set(this._body.quaternion.x, this._body.quaternion.y, this._body.quaternion.z, this._body.quaternion.w);
    }
}

export class View {
    private readonly _renderer: THREE.Renderer;
    private readonly _world: CANNON.World;
    private readonly _scene: THREE.Scene;
    private readonly _camera: THREE.Camera;
    private _cmeraPreviousY = 0;
    private readonly _ground: Ground;
    private _objects: Cube[] = [];
    private _symbol: SYMBOL.Symbol = new SYMBOL.Symbol(SYMBOL.SymbolKind.Null, 'null', '', 1, 1);

    private _controls: OrbitControls | null = null;
    private _interval: NodeJS.Timer | null = null;
    
	/** @constructor
	 * @param canvas    Webキャンバス
	 * @param width	    Webキャンバスの幅
	 * @param height    Webキャンバスの高さ
	 */
    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        // 描画機を作成
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
        //this._renderer.setClearColor(0x000000, 0); // default
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
        this._ground = new Ground(this._world, this._scene, new Distance(5000, 1, 5000), new THREE.Color('lightgreen'), 10);
        // カメラの生成
        this._camera = new THREE.PerspectiveCamera(45, width / height, 0.1, this._ground.size.x);
    }

	/** @function 破棄 */
	public dispose() {

		// 関連リソースを破棄
        this._objects = [];
        if (this._interval) { clearInterval(this._interval); }
        if (this._controls) { this._controls.dispose(); }
	}

    /** カメラ位置の再現
     * @param position カメラ位置
    */
    public positionningCamera(position: Location) {
        this._camera.position.set(position.x, position.y, position.z);
    }

    // カメラを全体が見える位置に移動
    public centerCamera() {
        const boundingBox = new THREE.Box3().setFromObject(this._scene);
        const boxCenter = new THREE.Vector3();
        const boxSize = new THREE.Vector3();
        boundingBox.getCenter(boxCenter);
        boundingBox.getSize(boxSize);
        this._camera.position.x = boxCenter.x;
        this._camera.position.y = 200 * 100;
        this._camera.position.z *= Math.max(boxSize.x, boxSize.y, boxSize.z);
    }

    /** 光あれ */
    public letThereBeLight() {
        // 光源を作成
        const directionalLight = new THREE.DirectionalLight('white');//PointLight('white');
        directionalLight.castShadow = true;
        //const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(this._ground.size.x, this._ground.size.x, this._ground.size.z);
        this._scene.add(directionalLight);
        // 環境光を作成
        const ambientLight = new THREE.AmbientLight('white');
        this._scene.add(ambientLight);
    }

    /** 行数から立方体の大きさを求める */
    private _cubeSizeByLineCount(lineCount: number): Distance {
        const cm = lineCount / 10;
        return new Distance(cm, cm, cm);
    }

    /** シンボル木の表示 */
    public showSymbolTree(symbolText: string, operation: string) {
        const symbol = symbolText.length > 0 ? JSON.parse(symbolText) as SYMBOL.Symbol : null;
        if (symbol) {

            // シンボルの再構成
            this._symbol = new SYMBOL.Symbol(symbol.kind, symbol.name, symbol.filename, symbol.startLine, symbol.endLine,
                symbol.updateId, symbol.position, symbol.quaternion);
            symbol.children.forEach(child => {
                const childSymbol = new SYMBOL.Symbol(child.kind, child.name, child.filename, child.startLine, child.endLine,
                    symbol.updateId, child.position, child.quaternion);
                this._symbol.addChild(childSymbol);
            });
            console.log(`showSymbolTree(${operation}):${JSON.stringify(this._symbol.updateId)}`);
            const axes = new THREE.AxesHelper();

            // オブジェクトのサンプルを生成
            const force = 10000000000;
            const ancorRadius = 0.25 * 100;
            this._createObjectSample(force, ancorRadius);

            // ファイル図を生成
            const fileSize = this._cubeSizeByLineCount(this._symbol.lineCount);
            let currentY = fileSize.y * 5;
            let previousBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, currentY, 0) });
            const filerMesh = new THREE.Mesh(new THREE.SphereGeometry(ancorRadius), new THREE.MeshPhongMaterial({ color: 'red' }));
            filerMesh.position.set(0, currentY, 0);
            this._scene.add(filerMesh);
            /////console.log(`child.name:${this._symbol.name} currentY:${currentY} size.y:${ancorRadius * 2}`);

            currentY -= ancorRadius * 2;
            let previousUnder = -ancorRadius;
            this._symbol.children.forEach(child => {

                // シンボルを作成
                const size = this._cubeSizeByLineCount(child.lineCount);
                const locateX = (Math.random() * fileSize.x) - (fileSize.x / 2);
                const locateZ = (Math.random() * fileSize.z) - (fileSize.z / 2);
                const position = new Location(0, currentY - (size.y / 2), 0);
                const color = this._convertSymbolKindToColor(child.kind);
                /////console.log(`child.name:${child.name} currentY:${currentY} size.y:${size.y}`);
                const cube = new Cube(this._world, this._scene, child, size, position, color);
                this._objects.push(cube);

                // シンボルと地面の接触
                const contactMaterial = new CANNON.ContactMaterial(cube.material, this._ground.material, {
                    friction: 0.5,                      // 摩擦係数
                    contactEquationStiffness: 100000 * 100,    // 剛性(変形し易さ)
                });
                this._world.addContactMaterial(contactMaterial);

                // 前のシンボルと接続
                const constraint = new CANNON.PointToPointConstraint(
                    previousBody,   new CANNON.Vec3(0, previousUnder, 0),  // 図形の中心からの接続点
                    cube._body,     new CANNON.Vec3(0, size.y / 2, 0), // 図形の中心からの接続点
                    force
                );
                this._world.addConstraint(constraint);

                // 前の１シンボル
                /////console.log(`previousUnder:${previousUnder} cube.size.y:${cube.size.y} cube.size.y / 2:${cube.size.y / 2}`);
                previousBody = cube._body;
                currentY -= size.y;
                previousUnder =  -size.y;
            });
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
        const ancorMesh = new THREE.Mesh(new THREE.SphereGeometry(ancorRadius), new THREE.MeshPhongMaterial({ color: 'red' }));
        ancorMesh.position.set(ancorPosition.x, ancorPosition.y, ancorPosition.z);
        this._scene.add(ancorMesh);

        // 1つ目のシンボルを生成
        const symbolFirst = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'first', '', 0, 80 - 1);
        const sizeFirst = this._cubeSizeByLineCount(symbolFirst.lineCount); // new Distance(1, 1, 1)
        const cubeFirst = new Cube(this._world, this._scene, symbolFirst, sizeFirst, new Location(500, 375, 0), 'gray');
        this._objects.push(cubeFirst);
        const constraintFirst = new CANNON.PointToPointConstraint(
            ancorBody,          new CANNON.Vec3(0, -ancorRadius, 0),   // ワールド座標の接続点
            cubeFirst._body,    new CANNON.Vec3(0, cubeFirst.size.y / 2, 0),   // 図形の中心からの接続点
            force
        );
        this._world.addConstraint(constraintFirst);

        // 2つ目のシンボルを生成
        const symbolSecond = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'second', '', 80, 80 + 500 - 1);
        const sizeSecond = this._cubeSizeByLineCount(symbolSecond.lineCount); // new Distance(1, 1, 1)
        const positionSecond = new Location(500, 275, 0);
        const cubeSecond = new Cube(this._world, this._scene, symbolSecond, sizeSecond, positionSecond, 'gray');
        this._objects.push(cubeSecond);
        const symbolInner = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'second', '', 80 + 500, (80 + 500) + 200 - 1);
        const sizeInner = this._cubeSizeByLineCount(symbolInner.lineCount);
        const cubeInner = new Cube(this._world, this._scene, symbolInner, sizeInner, positionSecond, 'red');
        this._objects.push(cubeInner);
        const constraintSecond = new CANNON.PointToPointConstraint(
            cubeFirst._body,    new CANNON.Vec3(0, -(cubeFirst.size.y / 2), 0),       // ワールド座標の接続点
            cubeSecond._body,   new CANNON.Vec3(0, cubeSecond.size.y / 2, 0),   // 図形の中心からの接続点
            force
        );
        this._world.addConstraint(constraintSecond);
    }

    /** 世界を生かす */
    public animateWorld(moveCamera: (position: Location) => void, saveSymbol: (symbol: SYMBOL.Symbol) => void) {
        // マウスでブラウズ
        this._controls = new OrbitControls(this._camera, this._renderer.domElement);
        this._controls.target.set(0, 0, 0);
        this._controls.update();
        
        this._controls.addEventListener('change', event => {
            // カメラの移動制限: 地面の下には行けない
            this._camera.position.y = this._camera.position.y > 0 ? this._camera.position.y : this._cmeraPreviousY;
////            this._cmeraPreviousY = this._camera.position.y;
            moveCamera(new Location(this._camera.position.x, this._camera.position.y, this._camera.position.z));
        });
        this._renderer.render(this._scene, this._camera);

        // 
        const cannonDebugger = CannonDebugger(this._scene, this._world, {});
        const animate = () => {
            // 
            this._ground.copy();
            this._objects.forEach(obj => obj.copy());
            // 
            this._world.fixedStep(); // framerate every 1 / 60 ms
            //cannonDebugger.update();
            this._renderer.render(this._scene, this._camera);
            requestAnimationFrame(animate);
        };
        animate();

        this._interval = setInterval(() => {
            this._objects.forEach(obj => {

                // メッシュの位置を保存する
                const position = obj._mesh.position;
                //obj.symbol.position = new SYMBOL.Position(position.x, position.y, position.z);
                obj.symbol.setPosition(position.x, position.y, position.z);

                // メッシュの回転を保存する
                const quaternion = obj._mesh.quaternion;
                //obj.symbol.quaternion = new SYMBOL.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
                obj.symbol.setQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
            });
            this._symbol.updateId = new Date().toISOString();
            saveSymbol(this._symbol);
        }, 200);
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
