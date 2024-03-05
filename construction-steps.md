# Construction steps

## Tips

- VSCode DevTools: Option+Command+I
- uninstall Extension: code --uninstall-extension suzukimitsuru.code-attractor

## 1.Three.js – JavaScript 3D Library

WebGLを使って三次元表現ができるライブラリ

- 参考: [three.js + TypeScript: 3次元空間で立方体を回してみる](https://qiita.com/FumioNonaka/items/dab4b854a1e3b541594c)

``` shell
npm install --save three
npm install --save-dev @types/three
npm install --save-dev three-orbitcontrols-ts
```

## 2.cannon.js - Lightweight 3D physics for the web

Webの為の軽い3次元物理エンジン

- 参考: [Cannon.js の世界へようこそ！ ３歩でわかる お手軽 物理シミュレーション](https://qiita.com/dsudo/items/66f41ef514344afeec4e)

``` shell
npm install --save cannon-es
npm install --save cannon-es-debugger
npm install --save-dev @types/cannon-es-debugger
```

## 3.シーン内を動き回れる WalkThroughControls を作る

視点を中心としたカメラの移動により、自然に三次元空間を移動したい。

- 視点: マウスポインタの位置/タッチパネルのピンチの中心
- 前進/後退: マウスのホイール/トラックパッドやタッチパネルのピンチ
- 方向転換: マウスのドラッグ/トラックパッドやタッチパネルのスワイプ

予定と言えないが、こんな事をしようと思っている。

- 3-1.OrbitControls を TypeScript に移植してみる。
- 3-2.コントローラのイベントと構造を考える。
- 　　　: (試行錯誤)
- 3-9.WalkThroughControls の完成!!
