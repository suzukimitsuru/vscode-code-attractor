import { Quaternion } from 'cannon-es';
import * as CANVAS from './canvas';
import * as SYMBOL from './symbol';
const vscode = acquireVsCodeApi();

let symbolText: string = '';

// キャンバスの描画
const drawCanvas = (): CANVAS.View => {

    // キャンバスの取得
    const element = document.getElementById('editor-canvas') as HTMLCanvasElement;
    const view = new CANVAS.View(element, window.innerWidth, window.innerHeight);
    
    // ウィンドウのサイズ変更
    window.addEventListener('resize', () => {
        view.resize(window.innerWidth, window.innerHeight);
    });

    // ポイントイベントの登録
    const tooltip = document.getElementById('editor-pointing-symbol-tooltip') as HTMLCanvasElement;
    element.addEventListener('dblclick', (event: MouseEvent) => {

        // ポイント位置を正規化
        const pointerX: number = ((event.clientX / window.innerWidth) * 2) - 1.1;
        const pointerY: number = -((event.clientY / window.innerHeight) * 2) + 1;

        // ポイント位置のシンボルが在ったら、行を指定してファイルを表示する
        view.findPointingSymbol(pointerX, pointerY, (symbol: SYMBOL.Symbol) => {
            vscode.postMessage({ command: 'showFileAtLine', filename: symbol.filename, lineNumber: symbol.startLine });
        });
    });
    element.addEventListener('pointermove', (event: PointerEvent) => {
        // ポイント位置を正規化
        const pointerX: number = ((event.clientX / window.innerWidth) * 2) - 1.1;
        const pointerY: number = -((event.clientY / window.innerHeight) * 2) + 1;

        // ポイント位置のシンボルが在ったら、行を指定してファイルを表示する
        let foundSymbols = '';
        view.findPointingSymbol(pointerX, pointerY, (symbol: SYMBOL.Symbol) => {
            if (foundSymbols.length > 0) { foundSymbols += ' '; }
            foundSymbols += symbol.name;
        });
        if (foundSymbols.length > 0) {
            tooltip.style.left = `${event.pageX + 10}px`; // マウス位置に10pxのオフセット
            tooltip.style.top = `${event.pageY + 10}px`;
            tooltip.innerText = foundSymbols;
            tooltip.style.display = 'block';
            element.classList.add('pointing-symbol-grab');
        } else {
            element.classList.remove('pointing-symbol-grab');
            tooltip.style.display = 'none';
        }
    });

    // シンボル木の再現
    const symbolElement = document.getElementById('symbol-tree');
    symbolText = symbolElement ? symbolElement.textContent??'' : '';
    if (symbolText.length > 0) { view.showSymbolTree(symbolText, 'review'); }

    // カメラが見ている位置と方向の再現
    const cameraText = document.getElementById('camera-store')?.innerText;
    const cameraLooking = cameraText   ? JSON.parse(cameraText) as CANVAS.Looking
        : new CANVAS.Looking(new CANVAS.Location(0, 500, 500), new CANVAS.Quaternion(0, 0, 0, 0));
    view.restoreCamera(cameraLooking);

    // 世界の作成
    view.letThereBeLight();
    view.animateWorld();

    view.addEventListener('moveCamera', (event) => {
        vscode.postMessage({ command: 'moveCamera', value: JSON.stringify(event.looking) });
    });
    view.addEventListener('saveSymbol', (event) => {
        const stringify = JSON.stringify(event.symbol);
        symbolText = stringify;
        vscode.postMessage({ command: 'saveSymbol', value: stringify });
    });
    view.addEventListener('debugLog', (event) => {
            vscode.postMessage({ command: 'debug', message: event.message });
        });
    //view.centerCamera();
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
    window.addEventListener("message", (event) => {
        switch (event.data.command) {
            case 'centerCamera':
                view?.centerCamera();
                break;
            case 'showSymbolTree':
                if (view) {
                    symbolText = event.data.value;
                    view.dispose();
                    view.showSymbolTree(symbolText, 'selected');
                }
                break;
        }
    });
});