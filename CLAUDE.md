# WireMock JP - 開発ガイド

WireMock用の日本語GUIクライアント（Vue 3 + Element Plus）

## コマンド

```bash
# 開発サーバー起動（http://localhost:5173）
npm run dev

# 本番ビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

## 技術スタック

- Vue 3 + TypeScript
- Element Plus（UIライブラリ）
- Pinia（状態管理）
- Vue Router（ルーティング）
- Vue I18n（日本語/英語対応）
- Monaco Editor（JSONエディタ）
- Axios（HTTP通信）

## ディレクトリ構成

```
src/
├── i18n/           # 多言語対応（ja.json, en.json）
├── router/         # ルーティング設定
├── services/       # WireMock API通信
├── stores/         # Pinia ストア（project, mapping, request）
├── types/          # TypeScript型定義
└── views/          # ページコンポーネント
```

## WireMock連携

開発時はViteのプロキシ経由でWireMockに接続：
- フロントエンド: http://localhost:5173
- WireMock: http://localhost:8080（デフォルト）
- プロキシ設定: `/__admin` → WireMock Admin API

### WireMockサーバー起動

```bash
# Dockerを使う場合（推奨）
docker run -it --rm -p 8080:8080 wiremock/wiremock

# JARファイルを使う場合
java -jar wiremock-standalone.jar --port 8080
```

WireMockが起動していないとNetwork Errorになります。

## 注意事項

- Node.js 20.19.0以上または22.12.0以上が必要
