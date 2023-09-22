(function () {
    const vscode = acquireVsCodeApi();
    document.querySelector('.show-editor').addEventListener('click', () => {
        vscode.postMessage({ type: 'showEditor', value: 'Button pushed.' });
    });
}());