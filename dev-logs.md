# Construction steps

VSCode DevTools: Option+Command+I
code --uninstall-extension suzukimitsuru.code-attractor

## 9.Three.js – JavaScript 3D Library

WebGLを使って三次元表現ができるライブラリ

- 参考: [three.js + TypeScript: 3次元空間で立方体を回してみる](https://qiita.com/FumioNonaka/items/dab4b854a1e3b541594c)

``` shell
npm install --save three
npm install --save-dev @types/three
npm install --save-dev three-orbitcontrols-ts
```

## 8.cannon.js - Lightweight 3D physics for the web

Webの為の軽い3次元物理エンジン

- 参考: [Cannon.js の世界へようこそ！ ３歩でわかる お手軽 物理シミュレーション](https://qiita.com/dsudo/items/66f41ef514344afeec4e)

``` shell
npm install --save cannon-es
npm install --save cannon-es-debugger
npm install --save-dev @types/cannon-es-debugger
```

## set Content-Security-Policy

``` html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} http: https: blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
```

``` html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; 
    img-src vscode-resource: ${webview.cspSource} http: https: blob:; 
    style-src vscode-resource: ${webview.cspSource}; 
    script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:;">
```

Refused to execute inline event handler because it violates the following Content Security Policy directive: "script-src 'nonce-r5LGArBtYFnzCASbaFZ9fvCkKAoPGsxF'". 
Either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required to enable inline execution. 
Note that hashes do not apply to event handlers, style attributes and javascript: navigations unless the 'unsafe-hashes' keyword is present.

Refused to execute inline event handler because it violates the following Content Security Policy directive: "script-src 'unsafe-inline' 'nonce-pVeeVTgD1ilRzmG67g9C2MFVJ9E4EOPp'". 
Note that 'unsafe-inline' is ignored if either a hash or nonce value is present in the source list.

script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:;">
script-src vscode-resource: 'nonce-${nonce}';">
