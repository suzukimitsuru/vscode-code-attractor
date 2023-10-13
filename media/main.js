(function () {
    const vscode = acquireVsCodeApi();
    document.querySelector('.two-button').addEventListener('click', () => {
        vscode.postMessage({ command: 'addCounter', value: 2 });
    });
    window.addEventListener("DOMContentLoaded", () => {

        // メッセージを受け取る
        window.addEventListener("message", event => {
            switch (event.data.command) {
            case "showCounter":
                const counter = document.getElementById("counter-value");
                counter.innerText = event.data.value;
                break;
            case "showWord":
                const word = document.getElementById("selected-word");
                word.innerText = event.data.value;
                break;
            }
        });
    });
}());