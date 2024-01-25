import * as THREE from 'three';
//import { OrbitControls } from 'three-orbitcontrols-ts'; // Sandbox ではズームできない。
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import * as SYMBOL from './symbol';
import { Color, Position } from 'vscode';

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
        console.log(`check: ${checkMeter} meter ${count} count ${checkColor.r * 256},${checkColor.g * 256},${checkColor.b * 256}`);
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
    public readonly symbol: SYMBOL.Symbol;
    public readonly material: CANNON.Material;
    public readonly _body: CANNON.Body;
    public readonly _mesh: THREE.Mesh;
    public constructor(world: CANNON.World, scene: THREE.Scene, symbol: SYMBOL.Symbol, size: Distance, position: Location, color?: string | number) {
        super(world, scene, size);
        this.symbol = symbol;
        this.material = new CANNON.Material({
            restitution: 0.5,   // 反発係数
        });
        const thickness = 0.001; // 厚み 1mm
        const density = 1;   // 水の密度: 1 g/mm3
        const kiro = 1000;
        const volume = ((size.x * kiro) * (size.y * kiro) * (size.z * kiro)) / kiro;
        console.log(`${symbol.name} line: ` + symbol.lineCount + ' / 1000 = volume:' + volume + ' -> meter:' + size.x + ' mass:' + (density * volume) / kiro);
        this._body = new CANNON.Body({
            mass: (density * volume) / kiro / 10, // 質量Kg
            material: this.material,
            position: new CANNON.Vec3(position.x, position.y, position.z),
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
        // 
        this._mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
//            new THREE.MeshBasicMaterial({ color: 'aqua' }),
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

export class View {
    private readonly _renderer: THREE.Renderer;
    private readonly _world: CANNON.World;
    private readonly _scene: THREE.Scene;
    private readonly _camera: THREE.Camera;
    private _cmeraPreviousY = 0;
    private readonly _ground: Ground;
    private _objects: ViewObject[] = [];
    
    constructor(canvas: HTMLCanvasElement, width: number, height: number, cameraPosision: Location | null) {
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
        // カメラを作成
        this._camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this._camera.position.z = cameraPosision ? cameraPosision.z : 5;
        this._camera.position.y = cameraPosision ? cameraPosision.y : 5;
        this._camera.position.x = cameraPosision ? cameraPosision.x : 0;
        // 地面を追加
        this._ground = new Ground(this._world, this._scene, new Distance(500, 0.01, 500), new THREE.Color('lightgreen'), 0.1);
    }

    /** 光あれ */
    public letThereBeLight() {
        // 光源を作成
        const directionalLight = new THREE.DirectionalLight('white');//PointLight('white');
        directionalLight.castShadow = true;
        //const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(1, 1, 1);
        this._scene.add(directionalLight);
        // 環境光を作成
        const ambientLight = new THREE.AmbientLight('white');
        this._scene.add(ambientLight);
    }

    /** 行数から立方体の大きさを求める */
    private _cubeSizeByLineCount(lineCount: number): Distance {
        const kiro = 1000;
        const mm = lineCount;
        const meter = mm / kiro;
        return new Distance(meter, meter, meter);
    }

    /** シンボル木の表示 */
    public showSymbolTree(symbol: SYMBOL.Symbol) {
        const axes = new THREE.AxesHelper();

        const ancorRadius = 0.25;
        const ancorBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(5, 4, 0) });
        const ancorMesh = new THREE.Mesh(
            new THREE.SphereGeometry(ancorRadius),
            new THREE.MeshPhongMaterial({ color: 'red' })
        );
        ancorMesh.position.set(5, 4, 0);
        this._scene.add(ancorMesh);

        const symbolFirst = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'first', 0, 100);
        const cubeFirst = new Cube(this._world, this._scene, symbolFirst, new Distance(1, 1, 1), new Location(5-1.5, 0.5, 0), 'gray');
        this._objects.push(cubeFirst);
        const constraintFirst = new CANNON.PointToPointConstraint(
            ancorBody,              new CANNON.Vec3(0, 0, 0),   // ワールド座標の接続点
            cubeFirst._body,    new CANNON.Vec3(0, cubeFirst.size.y / 2, 0),   // 図形の中心からの接続点
        );
        this._world.addConstraint(constraintFirst);

        const symbolSecond = new SYMBOL.Symbol(SYMBOL.SymbolKind.Function, 'second', 0, 100);
        const cubeSecond = new Cube(this._world, this._scene, symbolSecond, new Distance(1, 1, 1), new Location(5+1.5, 0.5, 0), 'gray');
        this._objects.push(cubeSecond);
        const cubeInner = new Cube(this._world, this._scene, symbolSecond, new Distance(0.2, 0.2, 0.2), new Location(5+1.5, 0.5, 0), 'red');
        this._objects.push(cubeInner);
        const constraintSecond = new CANNON.PointToPointConstraint(
            cubeFirst._body,    new CANNON.Vec3(0, -1, 0),   // ワールド座標の接続点
            cubeSecond._body,   new CANNON.Vec3(0, cubeSecond.size.y / 2, 0),   // 図形の中心からの接続点
        );
        this._world.addConstraint(constraintSecond);
/**/
        // ファイル図を生成
        const fileSize = this._cubeSizeByLineCount(symbol.lineCount);
        let previousBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, fileSize.y, 0) });
        const filerMesh = new THREE.Mesh(
            new THREE.SphereGeometry(ancorRadius),
            new THREE.MeshPhongMaterial({ color: 'red' })
        );
        filerMesh.position.set(0, fileSize.y, 0);

        this._scene.add(filerMesh);
        let previousBottom = 0;
        symbol.children.forEach(child => {

            // 種類により色を決める
            let color = '';
            switch (child.kind) {
                case SYMBOL.SymbolKind.Function:    color ='magenta';   break;
                case SYMBOL.SymbolKind.Method:      color ='magenta';   break;
                case SYMBOL.SymbolKind.Property:    color ='white';     break;
                case SYMBOL.SymbolKind.Class:       color ='orange';    break;
                case SYMBOL.SymbolKind.Variable:    color ='cyan';      break;
                default:                            color ='gray';      break;
            }
            //color = 'red';

            // シンボルを作成
            const size = this._cubeSizeByLineCount(child.lineCount);
            const locateX = (Math.random() * fileSize.x) - (fileSize.x / 2);
            const locateZ = (Math.random() * fileSize.z) - (fileSize.z / 2);
            const cube = new Cube(this._world, this._scene, child, size, new Distance(locateX, size.y, locateZ), color);
            this._objects.push(cube);
            // シンボルと地面の接触
            const contactMaterial = new CANNON.ContactMaterial(cube.material, this._ground.material, {
                friction: 0.5,                      // 摩擦係数
                contactEquationStiffness: 100000,    // 剛性(変形し易さ)
            });
            this._world.addContactMaterial(contactMaterial);
            // 前のシンボルと接続
            const constraint = new CANNON.PointToPointConstraint(
                previousBody,   new CANNON.Vec3(0, previousBottom, 0),  // 図形の中心からの接続点
                cube._body,     new CANNON.Vec3(0, cube.size.y / 2, 0), // 図形の中心からの接続点
            );
            this._world.addConstraint(constraint);

            // 前の１シンボル
            previousBody = cube._body;
            previousBottom = -size.y;
        });
    }

    public animateWorld(moveCamera: (position: Location) => void) {
        // マウスでブラウズ
        const controls = new OrbitControls(this._camera, this._renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.update();
        controls.addEventListener('change', event => {
            // カメラの移動制限: 地面の下には行けない
            this._camera.position.y = this._camera.position.y > 0 ? this._camera.position.y : this._cmeraPreviousY;
            this._cmeraPreviousY = this._camera.position.y;
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
    }
}
