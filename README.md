# vscode-code-attractor README

ソースコードの関係を引力図にして、システム全体を把握できると...イイな♪

## Features

- ディレクトリ・ファイル・名前空間でグループ分けして、依存を線で現わす。
  - 階層構造を飛ばした依存を発見できる。
- 依存関係の数を、引力として近く現わす。
  - 凝集度の関係を一覧できる。
- 行数を大きさとして、大きく現わす。
  - 行数が多すぎる複雑なモジュールを発見し易い。

## Rordmap

- 1.Visual Studio Code の拡張機能として動作させる。
  - 1-1.Code Attructor サイドバー を エクスプローラ サイドバー に表示する。
  - 1-2.Code Attructor エディタ を Webview で表示する。
  - 1-3.Code Attructor エディタ の Webview と連携する。 <- **今ココ！**
- 2.Typesctipt の依存関係を Code Attructor エディタ に表示する。
  - 2-1.Typesctipt のファイル木を表示する。
  - 2-2.Typesctipt のモジュール木を表示する。
  - 2-3.Typesctipt の関連を図にする。
  - 2-4.Typesctipt の関連を引力図にする。
- 3.他の言語に対応する。

## [開発者のための12の最高のコード視覚化](https://hashdork.com/ja/greatest-code-visualization-tools-for-developers/)

- [Sourcetrail](https://): 関係を視覚化
- [Embold](https://): 欠陥発見

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `myExtension.enable`: Enable/disable this extension.
- `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
