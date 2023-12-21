import * as THREE from 'three';
import * as CANNON from 'cannon';
//import { OrbitControls } from 'three-orbitcontrols-ts'; // Sandbox ではズームできない。
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const vscode = acquireVsCodeApi();
const axes = new THREE.AxesHelper();
const world = new CANNON.World();
function init() {
    // 空間を作成
	const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
	const size = { width: window.innerWidth, height: window.innerHeight };
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 1000);
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    //renderer.setClearColor(0x000000, 0); // default
	renderer.setSize(size.width, size.height);
    //scene.background = new THREE.Color().setColorName('green');
    // マウスでブラウズ
    const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(0, 0, 0);
	controls.update();
    // 光源を作成
	const directionalLight = new THREE.DirectionalLight('gray');
    //const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
	directionalLight.position.set(1, 1, 1);
	scene.add(directionalLight);
    // 環境光を作成
	const ambientLight = new THREE.AmbientLight('gray');
	scene.add(ambientLight);
    // 立方体を作成
	const geometry = new THREE.BoxGeometry(1, 1, 1);
	//const material = new THREE.MeshBasicMaterial({ color: 'aqua' });
    const material = new THREE.MeshPhongMaterial({ color: 'aqua' });
	const cube = new THREE.Mesh(geometry, material);
	scene.add(cube);
	camera.position.z = 5;
	renderer.render(scene, camera);
	cube.rotation.x += 0.5;
	cube.rotation.y += 0.5;
	renderer.render(scene, camera);
    // 立方体を回転
	const animate = () => {
		requestAnimationFrame(animate);
		// cube.rotation.x += 0.5;
		cube.rotation.x += 0.01;
		// cube.rotation.y += 0.5;
		cube.rotation.y += 0.01;
		renderer.render(scene, camera);
	};
	animate();
}
init();

document.querySelector('.two-button')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'countUp', value: 2 });
});

window.addEventListener("DOMContentLoaded", () => {

       // メッセージを受け取る
       window.addEventListener("message", event => {
        switch (event.data.command) {
        case "showCounter":
            const counter = document.getElementById("counter-value");
            if (counter) { counter.innerText = event.data.value; }
            break;
        case "showWord":            
            const word = document.getElementById("selected-word");
            if (word) { word.innerText = event.data.value; }
            break;
        }
    });
});