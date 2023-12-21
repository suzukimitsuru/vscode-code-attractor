# I wish to make a attracting foce diagram of the relationship between code

[![NPM Package][npm]][npm-url]
[![Build Size][build-size]][build-size-url]
[![NPM Downloads][npm-downloads]][npmtrends-url]
[![DeepScan][deepscan]][deepscan-url]
[![Discord][discord]][discord-url]

Code Attractor は、ソフトウェアの構造を維持しながら育ててゆくために作りました。  
関係の強さを引力として表現すれば、ソフトウェアの形が見える様になると考えています。  
良い設計のソフトウェアは、美しく見える事を期待しています。  
Visual Studio Code の拡張機能として動作します。

## Rordmap @beta

- 1.Visual Studio Code の拡張機能として動作させる。
  - 1-1.拡張機能プロジェクトを作成する。
  - 1-2.各部の操作方法を模索する。 <- **今ココ！**
  - 1-3.拡張機能を公開する。
- 2.呼び出し階層を表示する。
  - Visual Studio Code の呼び出し階層(Call Tree)を取得し表示できないか？
- 3.引力図を表示する。
  - 物理エンジンで三次元の引力図を表示する。

## Features @alpha

- ディレクトリ・ファイル・名前空間でグループ分けして、依存を線で現わす。
  - 階層構造を飛び越した依存を発見できる。
- 依存関係の数を、引力として近く現わす。
  - 凝集度の関係を一覧できる。
- 行数を大きさとして、大きく現わす。
  - 行数が多すぎる複雑なモジュールを発見し易い。

## Bbuild steps

こちらで[このプロジェクトを作った手順](construction-steps.markdown)を説明します。
