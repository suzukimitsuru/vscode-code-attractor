import * as CANVAS from './canvas';
const vscode = acquireVsCodeApi();

// キャンバスの描画
const drawCanvas = (): CANVAS.View => {
    const element = document.getElementById('editor-canvas') as HTMLCanvasElement;
    element.addEventListener('pointerdown', event => {});
    element.addEventListener('pointermove', event => {});
    element.addEventListener('pointerup', event => {});
    const cameraText = document.getElementById('camera-store')?.innerText;
    const position = cameraText ? JSON.parse(cameraText) as CANVAS.Location : null;
    const view = new CANVAS.View(element, window.innerWidth, window.innerHeight, position);
    view.letThereBeLight();
    view.animateWorld((position) => {
        vscode.postMessage({ command: 'moveCamera', value: JSON.stringify(position) });
    });
    return view;
};

// 「再描画」ボタン押下
document.querySelector('.redraw-button')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'redrawRequest', value: 2 });
});

// htmlファイル読み込み完了
let view: CANVAS.View | null = null;
window.addEventListener("DOMContentLoaded", () => {
    if (view === null) {
        vscode.postMessage({ command: 'operation', value: 'create canvas' });
        view = drawCanvas();
    }

    // メッセージを受け取る
    window.addEventListener("message", event => {
        switch (event.data.command) {
            case "drawCanvas":
                vscode.postMessage({ command: 'operation', value: 'redrw canvas' });
                view = drawCanvas();
                break;
            case "showSymbol":            
                //const word = document.getElementById("selected-word");
                //if (word) { word.innerText = event.data.value; }
                if (view) {
                    vscode.postMessage({ command: 'operation', value: JSON.stringify(event.data.value) });
                    view.showSymbolTree(event.data.value);
                }
                break;
        }
    });
});