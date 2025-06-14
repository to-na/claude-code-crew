# Claude Code Crew Custom

[![npm version](https://badge.fury.io/js/claude-code-crew.svg)](https://www.npmjs.com/package/claude-code-crew)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-code-crew.svg)](https://nodejs.org)

Git ワークツリー間で複数の Claude Code セッションを管理するための Web ベースインターフェース。

このプロジェクトは [to-na/claude-code-crew](https://github.com/to-na/claude-code-crew) をフォークし、独自の機能追加と改良を行ったカスタム版です。

## デモ

https://github.com/user-attachments/assets/a422e29d-eb0e-4cf2-bace-7f5e50f69cb5

## 機能

- 🖥️ **ブラウザベースターミナル**: xterm.js を使用した完全なターミナルエミュレーション
- 🔄 **リアルタイムセッション管理**: セッション状態の監視（ビジー/待機/アイドル）
- 🌳 **Git ワークツリー操作**: ワークツリーの作成、削除、マージ
- 🔌 **WebSocket 通信**: リアルタイム更新とターミナルストリーミング
- 🎨 **モダンな UI**: React と Material-UI で構築
- 📱 **シングルポートアーキテクチャ**: すべてが一つのポートで動作し、デプロイが簡単
- 🔔 **通知機能**: セッション状態変更時のブラウザ通知（カスタム機能）
- ⚡ **自動入力機能**: 定期的なコマンド自動実行（カスタム機能）

## 必要条件

- [Claude Code CLI](https://claude.ai/code) がインストールされ、PATH に含まれている必要があります
- Node.js 18+ 
- Git リポジトリ（このツールは Git ワークツリーを管理します）

## インストール

[![npm install claude-code-crew](https://nodei.co/npm/claude-code-crew.png?mini=true)](https://npmjs.org/package/claude-code-crew)

```bash
npm install -g claude-code-crew
```

## 使用方法

任意の Git リポジトリに移動して実行：

```bash
cd /path/to/your/git/repo
claude-code-crew
```

Web インターフェースは **http://localhost:3001** で利用できます

### 利用可能な機能:
- **ワークツリー表示**: サイドバーですべての git ワークツリーを確認
- **セッション作成**: 任意のワークツリーをクリックして Claude Code セッションを開始
- **状態監視**: リアルタイムセッション状態インジケーター（ビジー/待機/アイドル）
- **ターミナル履歴**: セッション間の切り替えと過去の出力確認
- **ワークツリー管理**: UI からワークツリーの作成、削除、マージ
- **通知設定**: ブラウザ通知の有効化/無効化
- **自動入力設定**: 定期的なコマンド実行の設定

## 設定

### 環境変数

- `PORT`: サーバーポート（デフォルト: 3001）
- `WORK_DIR`: 作業ディレクトリ（デフォルト: 現在のディレクトリ）
- `CC_CLAUDE_ARGS`: Claude Code セッション用の追加引数

### カスタムポートの例:
```bash
PORT=8080 claude-code-crew
```

## アーキテクチャ

### バックエンド (Node.js + Express + Socket.io)
- ワークツリー操作用 REST API
- ターミナルセッション用 WebSocket サーバー
- node-pty を使用した PTY 管理
- セッション状態検出と履歴保存

### フロントエンド (React + TypeScript + Material-UI)
- xterm.js によるターミナルエミュレーション
- リアルタイムセッション状態更新
- ワークツリー管理 UI
- レスポンシブサイドバーナビゲーション

### シングルポート設計
- API と Web UI を同一ポートで提供
- CORS 設定不要
- デプロイと使用が簡単

## 開発

claude-code-crew-custom の開発に貢献したい方向け：

### セットアップ
```bash
git clone https://github.com/kurasupedaichi/claude-code-crew-custom.git
cd claude-code-crew-custom
pnpm install
```

### 開発モード
```bash
# 開発環境を開始
./start.sh
```

### ビルド
```bash
pnpm run build
```

## 技術スタック

- **バックエンド**: Node.js, Express, Socket.io, node-pty
- **フロントエンド**: React, TypeScript, Material-UI, xterm.js
- **ビルドツール**: Vite, TypeScript
- **通信**: WebSocket, REST API

## カスタム機能

このフォーク版で追加された機能：

### 通知機能
- セッション状態変更時のブラウザ通知
- 通知許可ダイアログ
- 通知設定の ON/OFF 切り替え

### 自動入力機能
- 定期的なコマンド自動実行
- 実行間隔の設定
- 自動入力の有効化/無効化

## トラブルシューティング

### よくある問題

**"claude: command not found"**
- まず Claude Code CLI をインストールしてください: https://claude.ai/code

**"No worktrees found"**
- Git リポジトリ内でコマンドを実行していることを確認してください
- リポジトリに少なくとも一つのワークツリーがあることを確認してください

**ポートが既に使用中**
- ポートを変更してください: `PORT=8080 claude-code-crew`
- または、ポート 3001 を使用しているプロセスを停止してください

**ターミナル履歴が表示されない**
- ワークツリーを再度クリックしてセッションを再アクティブ化してください
- ブラウザコンソールで WebSocket 接続エラーを確認してください

## ライセンス

MIT

## 貢献

貢献を歓迎します！プルリクエストをお気軽に送信してください。

## 元のプロジェクト

このプロジェクトは [to-na/claude-code-crew](https://github.com/to-na/claude-code-crew) をベースにしています。元の作者に感謝いたします。

## サポート

このプロジェクトが役に立った場合は、以下をご検討ください：
- ⭐ リポジトリにスターを付ける
- 🐛 バグ報告や機能提案
- 💖 [スポンサーになる](https://github.com/sponsors/kurasupedaichi)