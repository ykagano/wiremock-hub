# WireMock Recording Integration 設計書

## 概要

WireMock Hubに、WireMockで記録されたリクエスト/レスポンスを閲覧・インポートする機能を追加する。

## 背景

現状のWireMock Hubは以下の制約がある:

- Hub → WireMock への一方向同期のみ
- WireMockで記録したスタブをHubにインポートする機能がない
- `sync-all` 実行時にWireMock側は全リセットされ、記録が消える

プロキシスタブを使って実際のAPIレスポンスを記録し、それをモックの雛形として活用したい。

## 機能要件

### 1. 記録履歴の閲覧機能

WireMock上のリクエスト履歴（`/__admin/requests`）をHub UIで一覧表示する。

**表示項目:**
- リクエスト日時
- HTTPメソッド
- URL
- ステータスコード
- レスポンス時間

**フィルタリング:**
- URLパターン
- HTTPメソッド
- ステータスコード範囲
- 日時範囲

### 2. 記録詳細の閲覧機能

一覧から選択したリクエストの詳細を表示する。

**リクエスト詳細:**
- URL（フルパス）
- HTTPメソッド
- ヘッダー一覧
- クエリパラメータ
- リクエストボディ（JSON整形表示）

**レスポンス詳細:**
- ステータスコード
- ヘッダー一覧
- レスポンスボディ（JSON整形表示）
- レスポンス時間

### 3. スタブインポート機能

記録からワンクリックでHubにスタブとして取り込む。

**基本フロー:**
1. 記録詳細画面で「Import as Stub」ボタンをクリック
2. インポート設定ダイアログが表示
3. 設定を調整して「Import」
4. HubのStubとしてSQLiteに保存

**インポート設定:**
- スタブ名（デフォルト: `{method} {path}`）
- URLマッチング方式
  - `urlPath`: 完全一致
  - `urlPathPattern`: 正規表現
- リクエストマッチング条件
  - ヘッダー（含める/除外するヘッダーを選択）
  - クエリパラメータ
  - ボディマッチング
- レスポンス設定
  - ステータスコード
  - ヘッダー（含める/除外するヘッダーを選択）
  - ボディ

### 4. レスポンス値のランダム化機能

レスポンスボディの特定フィールドをWireMockテンプレート変数に変換する。

**対応する変換:**
| 変換タイプ | テンプレート | 用途 |
|-----------|-------------|------|
| UUID | `{{randomValue type='UUID'}}` | ID生成 |
| 現在日時 | `{{now}}` | タイムスタンプ |
| 現在日時(ISO) | `{{now format='yyyy-MM-dd'T'HH:mm:ss.SSSZ'}}` | ISO形式日時 |
| Unixタイムスタンプ | `{{now format='epoch'}}` | エポック秒 |
| ランダム数値 | `{{randomValue type='NUMERIC' length=10}}` | 数値ID |
| リクエストからコピー | `{{request.body.fieldName}}` | リクエスト値の反映 |

**UI操作:**
1. レスポンスボディのJSONツリー表示
2. 各フィールドをクリックして変換タイプを選択
3. プレビューで変換後のテンプレートを確認
4. 「Apply」で反映

## 画面設計

### 記録一覧画面

```
┌─────────────────────────────────────────────────────────────┐
│ Recorded Requests                              [Refresh] [Clear] │
├─────────────────────────────────────────────────────────────┤
│ Filter: [URL pattern    ] [Method ▼] [Status ▼] [Search]   │
├─────────────────────────────────────────────────────────────┤
│ Time          │ Method │ URL                    │ Status │ │
├───────────────┼────────┼────────────────────────┼────────┤ │
│ 14:32:05.123  │ POST   │ /payjp/v1/charges      │ 200    │→│
│ 14:32:04.891  │ GET    │ /payjp/v1/customers/...│ 200    │→│
│ 14:32:03.456  │ POST   │ /amazonpay/v2/checkout │ 201    │→│
│ ...           │        │                        │        │ │
└─────────────────────────────────────────────────────────────┘
```

### 記録詳細画面

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back                                    [Import as Stub]  │
├─────────────────────────────────────────────────────────────┤
│ Request                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ POST /payjp/v1/charges                                  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Headers                                                 │ │
│ │   Content-Type: application/json                        │ │
│ │   Authorization: Bearer sk_test_xxxxx                   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Body                                                    │ │
│ │   {                                                     │ │
│ │     "amount": 1000,                                     │ │
│ │     "currency": "jpy",                                  │ │
│ │     "card": "tok_xxxxx"                                 │ │
│ │   }                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Response (200 OK, 234ms)                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Headers                                                 │ │
│ │   Content-Type: application/json                        │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Body                                    [Randomize...]  │ │
│ │   {                                                     │ │
│ │     "id": "ch_xxxxx",        ← [Click to randomize]     │ │
│ │     "created": 1234567890,   ← [Click to randomize]     │ │
│ │     "amount": 1000,                                     │ │
│ │     ...                                                 │ │
│ │   }                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### インポート設定ダイアログ

```
┌─────────────────────────────────────────────────────────────┐
│ Import as Stub                                        [×]   │
├─────────────────────────────────────────────────────────────┤
│ Stub Name: [POST /v1/charges                           ]    │
│                                                             │
│ Request Matching                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ URL Pattern: [urlPath ▼] [/v1/charges              ]    │ │
│ │                                                         │ │
│ │ Headers to match:                                       │ │
│ │   [✓] Content-Type                                      │ │
│ │   [ ] Authorization (contains sensitive data)           │ │
│ │                                                         │ │
│ │ Body matching: [equalToJson ▼]                          │ │
│ │   [ ] Ignore array order                                │ │
│ │   [ ] Ignore extra elements                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Response                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Status: [200]                                           │ │
│ │                                                         │ │
│ │ Headers to include:                                     │ │
│ │   [✓] Content-Type                                      │ │
│ │                                                         │ │
│ │ [✓] Enable response templating                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [Cancel]  [Import]             │
└─────────────────────────────────────────────────────────────┘
```

## API設計

### Backend API

#### 記録一覧取得

```
GET /api/instances/:instanceId/recordings
```

**Query Parameters:**
- `urlPattern` (optional): URLフィルタ（正規表現）
- `method` (optional): HTTPメソッドフィルタ
- `statusFrom` (optional): ステータスコード下限
- `statusTo` (optional): ステータスコード上限
- `limit` (optional): 取得件数（デフォルト: 100）

**Response:**
```json
{
  "recordings": [
    {
      "id": "request-uuid",
      "timestamp": "2025-01-15T14:32:05.123Z",
      "request": {
        "method": "POST",
        "url": "/payjp/v1/charges",
        "headers": {...}
      },
      "response": {
        "status": 200,
        "headers": {...}
      },
      "responseTime": 234
    }
  ],
  "total": 50
}
```

#### 記録詳細取得

```
GET /api/instances/:instanceId/recordings/:recordingId
```

**Response:**
```json
{
  "id": "request-uuid",
  "timestamp": "2025-01-15T14:32:05.123Z",
  "request": {
    "method": "POST",
    "url": "/payjp/v1/charges",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer sk_test_xxxxx"
    },
    "body": "{\"amount\":1000,...}"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": "{\"id\":\"ch_xxxxx\",...}"
  },
  "responseTime": 234
}
```

#### 記録をスタブとしてインポート

```
POST /api/instances/:instanceId/recordings/:recordingId/import
```

**Request Body:**
```json
{
  "projectId": "project-uuid",
  "name": "POST /v1/charges",
  "urlMatchType": "urlPath",
  "urlPattern": "/v1/charges",
  "matchHeaders": ["Content-Type"],
  "bodyMatchType": "equalToJson",
  "bodyMatchOptions": {
    "ignoreArrayOrder": false,
    "ignoreExtraElements": true
  },
  "responseHeaders": ["Content-Type"],
  "enableTemplating": true,
  "templateTransforms": [
    {
      "path": "$.id",
      "template": "{{randomValue type='UUID'}}"
    },
    {
      "path": "$.created",
      "template": "{{now format='epoch'}}"
    }
  ]
}
```

**Response:**
```json
{
  "stub": {
    "id": "stub-uuid",
    "name": "POST /v1/charges",
    "mapping": {...}
  }
}
```

#### 記録のクリア

```
DELETE /api/instances/:instanceId/recordings
```

### WireMock Admin API（参照）

これらのAPIを内部的に呼び出す:

- `GET /__admin/requests` - リクエスト履歴取得
- `GET /__admin/requests/:id` - リクエスト詳細取得
- `DELETE /__admin/requests` - 履歴クリア

## データモデル

### 既存モデル（変更なし）

```prisma
model Stub {
  id        String   @id @default(uuid())
  projectId String
  name      String
  mapping   Json     // WireMock mapping JSON
  version   Int      @default(1)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  project   Project  @relation(fields: [projectId], references: [id])
}
```

### インポート時の処理

記録からスタブを生成する際、以下の形式でmappingを構築:

```json
{
  "name": "POST /v1/charges",
  "request": {
    "method": "POST",
    "urlPath": "/v1/charges",
    "headers": {
      "Content-Type": {
        "equalTo": "application/json"
      }
    }
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "id": "{{randomValue type='UUID'}}",
      "created": "{{now format='epoch'}}",
      "amount": 1000
    },
    "transformers": ["response-template"]
  }
}
```

## 実装計画

### Phase 1: 記録閲覧機能

1. Backend API実装
   - `GET /api/instances/:instanceId/recordings`
   - `GET /api/instances/:instanceId/recordings/:recordingId`
   - `DELETE /api/instances/:instanceId/recordings`

2. Frontend実装
   - 記録一覧コンポーネント
   - 記録詳細コンポーネント
   - フィルタリング機能

### Phase 2: スタブインポート機能

1. Backend API実装
   - `POST /api/instances/:instanceId/recordings/:recordingId/import`
   - マッピングJSON生成ロジック

2. Frontend実装
   - インポート設定ダイアログ
   - プレビュー機能

### Phase 3: レスポンスランダム化機能

1. JSONパス指定によるテンプレート変換ロジック
2. Frontend実装
   - JSONツリービュー
   - フィールド選択・変換UI
   - プレビュー機能

## セキュリティ考慮事項

### 認証情報の取り扱い

- 記録には認証ヘッダー（Authorization等）が含まれる可能性がある
- インポート時にデフォルトで認証ヘッダーを除外する
- UIで警告を表示（「contains sensitive data」）

### アクセス制御

- 記録閲覧・インポート機能はプロジェクトメンバーのみアクセス可能
- 本番環境のWireMockインスタンスでは記録機能を無効化推奨

## 参考資料

- [WireMock Record and Playback](https://wiremock.org/docs/record-playback/)
- [WireMock Admin API](https://wiremock.org/docs/api/)
- [WireMock Response Templating](https://wiremock.org/docs/response-templating/)
