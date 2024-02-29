import * as CANVAS from './canvas';
import * as SYMBOL from './symbol';
const vscode = acquireVsCodeApi();

let symbolText: string = '';

// キャンバスの描画
const drawCanvas = (): CANVAS.View => {

    // キャンバスの取得
    const element = document.getElementById('editor-canvas') as HTMLCanvasElement;
    const view = new CANVAS.View(element, window.innerWidth, window.innerHeight);
    
    // ポイントイベントの登録
    element.onpointerdown = (event: PointerEvent) => {

        // ポイント位置を正規化
        const pointerX: number = ((event.clientX / window.innerWidth) * 2) - 1;
        const pointerY: number = -((event.clientY / window.innerHeight) * 2) + 1;

        // ポイント位置のシンボルが在ったら、行を指定してファイルを表示する
        view.findPointingSymbol(pointerX, pointerY, (symbol: SYMBOL.Symbol) => {
            vscode.postMessage({ command: 'showFileAtLine', filename: symbol.filename, lineNumber: symbol.startLine });
        });
    };
    element.onpointermove = (event: PointerEvent) => {};
    element.onpointerup = (event: PointerEvent) => {};

    // カメラ位置の再現
    const cameraText = document.getElementById('camera-store')?.innerText;
    const cameraPosition = cameraText ? JSON.parse(cameraText) as CANVAS.Location : new CANVAS.Location(0, 500, 500);
    view.positionningCamera(cameraPosition);

    // シンボル木の再現
    const symbolElement = document.getElementById('symbol-tree');
    symbolText = symbolElement ? symbolElement.textContent??'' : '';
    if (symbolText.length > 0) { view.showSymbolTree(symbolText, 'review'); }

    // 世界の作成
    view.letThereBeLight();
    view.animateWorld(
        (position) => { vscode.postMessage({ command: 'moveCamera', value: JSON.stringify(position) }); },
        (symbol)   => {
            const stringify = JSON.stringify(symbol);
            symbolText = stringify;
            vscode.postMessage({ command: 'saveSymbol', value: stringify });
        }
    );
    return view;
};

// 「再描画」ボタン押下
document.querySelector('.redraw-button')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'centerCamera', value: 2 });
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
                ////view = drawCanvas();
                break;
            case 'centerCamera':
                view?.centerCamera();
                break;
            case 'showSymbolTree':
                if (view) {
                    symbolText = event.data.value;
                    ////view.dispose();
                    view.showSymbolTree(symbolText, 'selected');
                }
                break;
        }
    });
});