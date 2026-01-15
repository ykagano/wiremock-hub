# WireMock Hub - 開発ガイド

分散WireMock環境の一元管理に対応した、WireMock用日本語GUIクライアント。

## 主な機能

- **分散WireMock対応**: 複数のWireMockインスタンスにスタブを一括同期
- **データ永続化**: SQLiteファイルに保存、外部DB不要でシンプル
- **チーム共有**: DBファイルを共有またはDockerボリュームでマウント
- **日本語/英語UI**: Element Plusによる多言語対応インターフェース

## クイックスタート

### Docker（推奨）

最も簡単な方法は、All-in-One Dockerイメージを使用することです。

```bash
# All-in-One版（Hub + WireMock + nginx が同梱）
docker run -d \
  -p 80:80 \
  -v $(pwd)/data:/app/packages/backend/data \
  --name wiremock-hub \
  ghcr.io/youruser/wiremock-hub:latest
```

- UI: http://localhost/hub/
- WireMock Admin API: http://localhost/__admin/
- モックレスポンス: http://localhost/

詳細は [allinone/README.md](./allinone/README.md) を参照してください。

### ローカル開発

#### 1. 前提条件

- Node.js 20.19.0以上 または 22.12.0以上
- pnpm（`npm install -g pnpm`）
- WireMock（オプション：スタブ同期時に必要）

#### 2. 初期セットアップ

```bash
# 依存パッケージインストール
pnpm install

# 環境変数設定
cp packages/backend/.env.example packages/backend/.env

# Prismaクライアント生成
pnpm run db:generate

# DBマイグレーション実行
cd packages/backend
npx prisma migrate dev

# ルートに戻る
cd ../..
```

#### 3. 開発サーバー起動

```bash
# 全サービス同時起動（推奨）
pnpm run dev
```

起動後のURL:
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:3000

#### 4. 初回利用

1. http://localhost:5173 にアクセス
2. プロジェクトを作成（WireMock URL = ロードバランサーURL）
3. WireMockインスタンスを追加（個別サーバーURL）
4. スタブを作成
5. 全インスタンスに同期

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        WireMock Hub                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │ -> │   Backend    │ -> │    SQLite    │      │
│  │   (Vue 3)    │    │  (Fastify)   │    │   (永続化)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Admin API経由で同期
                              ▼
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │ WireMock │         │ WireMock │         │ WireMock │
   │ Instance │         │ Instance │         │ Instance │
   │    #1    │         │    #2    │         │    #3    │
   └──────────┘         └──────────┘         └──────────┘
```

## デプロイ方法

### All-in-One Docker（推奨）

Hub + WireMock + nginx が同梱された単一コンテナです。

**特徴:**
- 1つのコンテナで完結（ポート80のみ公開）
- ECS/Fargateなど単一ポート制約がある環境に最適
- 簡単セットアップ

**起動方法:**

```bash
docker run -d \
  -p 80:80 \
  -v $(pwd)/data:/app/packages/backend/data \
  --name wiremock-hub \
  ghcr.io/youruser/wiremock-hub:latest
```

**アクセスURL:**
- Hub UI: `http://localhost/hub/`
- WireMock Admin API: `http://localhost/__admin/`
- モックレスポンス: `http://localhost/`

**追加のWireMockインスタンスを登録:**
All-in-One版にも、UI から追加のWireMockインスタンスを登録できます。
1台目はコンテナ内蔵、2台目以降は別サーバーで動作させて登録する形です。

詳細は [allinone/README.md](./allinone/README.md) を参照してください。

### Standalone Docker（高度な用途）

Hubのみを単体で起動し、既存のWireMockインフラと接続する場合に使用します。

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/packages/backend/data \
  --name wiremock-hub \
  ghcr.io/youruser/wiremock-hub-standalone:latest
```

その後、UIから既存のWireMockインスタンスを登録します。

### Docker Compose

```bash
# All-in-One版（ローカルビルド）
cd allinone && docker compose up -d

# Standalone版 + デモ用WireMock
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

## データ永続化

SQLiteファイルは `packages/backend/data/wiremock-hub.db` に保存されます。

### ローカル開発
- ファイルは自動生成されます
- バックアップはファイルをコピーするだけ

### Docker運用
```yaml
services:
  wiremock-hub:
    volumes:
      - ./data:/app/packages/backend/data  # SQLiteファイルを永続化
    environment:
      - DATABASE_URL=file:./data/wiremock-hub.db
```

**重要:** All-in-One版でも同様に、ボリュームマウントでデータを永続化できます。

## Docker イメージのリリース

GitHub Actions で Docker イメージを自動ビルドし、GitHub Container Registry と Docker Hub に公開します。

### リリース手順

```bash
# バージョンタグを作成してプッシュ
git tag v0.1.0
git push origin v0.1.0
```

### 自動公開されるイメージ

#### GitHub Container Registry (ghcr.io)

| イメージ | 説明 |
|---------|------|
| `ghcr.io/ykagano/wiremock-hub:latest` | All-in-One版（推奨） |
| `ghcr.io/ykagano/wiremock-hub:0.1.0` | バージョン指定 |
| `ghcr.io/ykagano/wiremock-hub-standalone:latest` | Hub単体版 |

#### Docker Hub

| イメージ | 説明 |
|---------|------|
| `ykagano/wiremock-hub:latest` | All-in-One版（推奨） |
| `ykagano/wiremock-hub:0.1.0` | バージョン指定 |
| `ykagano/wiremock-hub-standalone:latest` | Hub単体版 |

### GitHub Secrets の設定

Docker Hub への公開には以下の Secrets が必要です:

- `DOCKERHUB_USERNAME`: Docker Hub のユーザー名
- `DOCKERHUB_TOKEN`: Docker Hub のアクセストークン

### 手動実行

GitHub の Actions タブから `workflow_dispatch` で手動実行も可能です。

### リリース後の動作確認

```bash
# GitHub Container Registry から起動
docker run -d -p 80:80 --name wiremock-hub-test ghcr.io/ykagano/wiremock-hub:latest

# または Docker Hub から起動
docker run -d -p 80:80 --name wiremock-hub-test ykagano/wiremock-hub:latest

# ブラウザで確認
open http://localhost/hub/

# 確認後にクリーンアップ
docker stop wiremock-hub-test && docker rm wiremock-hub-test
```

### ワークフロー設定

`.github/workflows/docker-publish.yml` で定義されています。

## プロジェクト構成

モノレポ構成（pnpm workspace）：
- `packages/frontend` - Vue 3フロントエンド
- `packages/backend` - Fastify + Prisma APIサーバー
- `packages/shared` - 共通型定義
- `e2e` - Playwright E2Eテスト

## コマンド一覧

```bash
# 依存パッケージインストール
pnpm install

# 全パッケージビルド
pnpm run build

# フロントエンド開発サーバー起動（http://localhost:5173）
pnpm run dev:frontend

# バックエンド開発サーバー起動（http://localhost:3000）
pnpm run dev:backend

# 全サービス同時起動
pnpm run dev
```

### バックエンドコマンド

```bash
cd packages/backend

# DBマイグレーション
npx prisma migrate dev

# Prismaクライアント生成
pnpm run db:generate

# DBスキーマをDBに直接反映（開発用）
pnpm run db:push

# Prisma Studio（DBブラウザ）
pnpm run db:studio
```

## 技術スタック

### フロントエンド
- Vue 3 + TypeScript
- Element Plus（UIライブラリ）
- Pinia（状態管理）
- Vue Router（ルーティング）
- Vue I18n（日本語/英語対応）
- Monaco Editor（JSONエディタ）
- Axios（HTTP通信）

### バックエンド
- Fastify（Webフレームワーク）
- Prisma（ORM）
- SQLite（データベース）
- Zod（バリデーション）

## ディレクトリ構成

```
packages/
├── frontend/
│   └── src/
│       ├── i18n/           # 多言語対応（ja.json, en.json）
│       ├── router/         # ルーティング設定
│       ├── services/       # API通信
│       ├── stores/         # Pinia ストア
│       ├── types/          # TypeScript型定義
│       └── views/          # ページコンポーネント
├── backend/
│   ├── data/               # SQLiteデータベースファイル
│   ├── prisma/             # DBスキーマ・マイグレーション
│   └── src/
│       ├── routes/         # APIルート（projects, stubs, wiremock-instances）
│       └── index.ts        # エントリーポイント
└── shared/
    └── src/types/          # 共通型定義
```

## API エンドポイント

### プロジェクト
- `GET /api/projects` - プロジェクト一覧
- `POST /api/projects` - プロジェクト作成
- `GET /api/projects/:id` - プロジェクト詳細
- `PUT /api/projects/:id` - プロジェクト更新
- `DELETE /api/projects/:id` - プロジェクト削除

### スタブ
- `GET /api/stubs?projectId=` - スタブ一覧
- `POST /api/stubs` - スタブ作成
- `PUT /api/stubs/:id` - スタブ更新
- `DELETE /api/stubs/:id` - スタブ削除
- `POST /api/stubs/:id/sync` - WireMockに同期
- `POST /api/stubs/sync-all` - 全スタブをWireMockに同期（リセット後に登録）

### WireMockインスタンス
- `GET /api/wiremock-instances?projectId=` - インスタンス一覧
- `POST /api/wiremock-instances` - インスタンス登録
- `GET /api/wiremock-instances/:id` - インスタンス詳細（ヘルスチェック含む）
- `PUT /api/wiremock-instances/:id` - インスタンス更新
- `DELETE /api/wiremock-instances/:id` - インスタンス削除
- `GET /api/wiremock-instances/:id/mappings` - マッピング取得
- `GET /api/wiremock-instances/:id/requests` - リクエストログ取得
- `POST /api/wiremock-instances/:id/reset` - インスタンスリセット

## WireMock連携

### WireMockサーバー起動

```bash
# Dockerを使う場合（推奨）
docker run -it --rm -p 8080:8080 wiremock/wiremock

# JARファイルを使う場合
java -jar wiremock-standalone.jar --port 8080
```

### プロジェクト vs インスタンス

| 項目 | 用途 | 例 |
|------|------|-----|
| **プロジェクト WireMock URL** | クライアントがアクセスするロードバランサーURL | `http://api-mock.example.com` |
| **インスタンスURL** | 個別サーバーの管理API用URL | `http://wiremock-1:8080` |

単一サーバー構成の場合は、両方同じURLで問題ありません。

### 同期の動作

「全インスタンスに同期」ボタンをクリックすると:
1. WireMockのマッピングを全削除（reset）
2. SQLiteのスタブを全て登録

これにより、SQLiteとWireMockの状態が常に一致します。

## E2Eテスト

Playwrightを使用したE2Eテスト。デモ用Dockerコンテナに対してテストを実行します。

### テスト実行

```bash
# デモ用Docker環境を起動
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d

# E2Eテスト実行
pnpm test:e2e

# UIモードでテスト（デバッグ向け）
pnpm test:e2e:ui

# ブラウザ表示ありでテスト
pnpm test:e2e:headed

# テスト後にデータを残す（クリーンアップなし）
pnpm test:e2e:keep-data

# ブラウザ表示あり + データを残す
pnpm test:e2e:keep-data:headed
```

### クリーンアップについて

通常のテストでは、テスト終了後に作成したプロジェクトを自動削除します。
デバッグや動作確認のためにデータを残したい場合は `test:e2e:keep-data` を使用してください。

### テスト内容

- プロジェクト作成・編集・削除
- WireMockインスタンスの追加・ヘルスチェック
- スタブ作成・編集
- 全インスタンスへの同期
- フォームバリデーション
- 言語切り替え

### デモ用インスタンス

- WireMock 1: http://localhost:8081
- WireMock 2: http://localhost:8082

## 注意事項

- Node.js 20.19.0以上または22.12.0以上が必要
- 認証なし：全員が全データにアクセス可能
- スタブはSQLiteに保存され、Admin API経由でWireMockに同期される
- SQLiteファイルは `packages/backend/data/` に保存（.gitignoreで除外済み）
