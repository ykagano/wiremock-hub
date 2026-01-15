# WireMock Recording Integration 詳細設計書

## 概要

本ドキュメントは `wiremock-recording-integration.md` の詳細設計を補足するものです。
調査結果と実装方針の詳細を記載します。

## 実装スコープ

| Phase | 内容 | 今回のスコープ |
|-------|------|---------------|
| Phase 1 | 記録閲覧機能（一覧・詳細・フィルタ） | ✅ 対象 |
| Phase 2 | スタブインポート機能 | ✅ 対象 |
| Phase 3 | レスポンスランダム化機能 | ❌ 後回し |

## WireMock Admin API 仕様

### リクエスト一覧取得

```
GET /__admin/requests
```

**クエリパラメータ:**
- `since` (ISO8601): 指定日時以降のリクエストを取得
- `limit` (number): 取得件数制限
- `unmatched` (boolean): マッチしなかったリクエストのみ
- `matchingStub` (UUID): 特定スタブにマッチしたリクエストのみ

**レスポンス形式:**
```json
{
  "requests": [
    {
      "id": "request-uuid",
      "request": {
        "url": "/path",
        "absoluteUrl": "http://host:port/path",
        "method": "GET",
        "headers": { "Header-Name": "value" },
        "body": "request body",
        "bodyAsBase64": "...",
        "loggedDate": 1234567890,
        "loggedDateString": "2026-01-15T03:09:22.088Z",
        "queryParams": {},
        "cookies": {}
      },
      "responseDefinition": {
        "status": 200,
        "body": "stub defined response"
      },
      "response": {
        "status": 200,
        "headers": { "Content-Type": "application/json" },
        "body": "actual response body"
      },
      "wasMatched": true,
      "timing": {
        "addedDelay": 0,
        "processTime": 0,
        "responseSendTime": 0,
        "serveTime": 0,
        "totalTime": 0
      },
      "stubMapping": { ... }
    }
  ],
  "meta": { "total": 1 },
  "requestJournalDisabled": false
}
```

### 個別リクエスト取得

```
GET /__admin/requests/:id
```

レスポンスは一覧の個別要素と同じ形式。

### リクエスト履歴クリア

```
DELETE /__admin/requests
```

## フロントエンド設計

### ルーティング

既存の `/requests` を拡張する方針。

| パス | コンポーネント | 説明 |
|------|--------------|------|
| `/requests` | RequestsView.vue | 記録一覧（既存を拡張） |
| `/requests/:id` | RequestDetailView.vue | 記録詳細（新規追加） |

### 型定義の更新

`packages/frontend/src/types/wiremock.ts` の `LoggedRequest` を実際のAPIに合わせて拡張:

```typescript
export interface LoggedRequest {
  id: string
  request: {
    url: string
    absoluteUrl: string
    method: string
    clientIp?: string
    headers: Record<string, any>
    cookies?: Record<string, any>
    body?: string
    bodyAsBase64?: string
    loggedDate: number
    loggedDateString: string
    queryParams?: Record<string, string>
    formParams?: Record<string, string>
  }
  responseDefinition?: {
    status: number
    body?: string
    headers?: Record<string, string>
  }
  response?: {
    status: number
    headers?: Record<string, string>
    body?: string
    bodyAsBase64?: string
  }
  wasMatched: boolean
  timing?: {
    addedDelay: number
    processTime: number
    responseSendTime: number
    serveTime: number
    totalTime: number
  }
  stubMapping?: Mapping
}
```

### コンポーネント構成

```
packages/frontend/src/
├── views/
│   ├── RequestsView.vue        # 拡張（フィルタ追加）
│   └── RequestDetailView.vue   # 新規
├── components/
│   └── request/
│       ├── RequestTable.vue    # 拡張（行クリックで詳細遷移）
│       ├── RequestFilter.vue   # 新規
│       └── ImportStubDialog.vue # 新規
```

## バックエンド設計

### 新規APIエンドポイント

既存の `wiremock-instances.ts` に追加:

#### 個別リクエスト取得
```
GET /api/wiremock-instances/:id/requests/:requestId
```

#### スタブインポート
```
POST /api/wiremock-instances/:id/requests/:requestId/import
```

**リクエストボディ:**
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
  "enableTemplating": false
}
```

### マッピングJSON生成ロジック

インポート設定からWireMockマッピングJSONを生成:

```typescript
function generateMapping(request: LoggedRequest, options: ImportOptions): Mapping {
  const mapping: Mapping = {
    name: options.name,
    request: {
      method: request.request.method,
      [options.urlMatchType]: options.urlPattern
    },
    response: {
      status: request.response?.status || 200
    }
  }

  // ヘッダーマッチング
  if (options.matchHeaders.length > 0) {
    mapping.request.headers = {}
    for (const header of options.matchHeaders) {
      if (request.request.headers[header]) {
        mapping.request.headers[header] = {
          equalTo: request.request.headers[header]
        }
      }
    }
  }

  // ボディマッチング
  if (options.bodyMatchType && request.request.body) {
    mapping.request.bodyPatterns = [{
      [options.bodyMatchType]: request.request.body,
      ...options.bodyMatchOptions
    }]
  }

  // レスポンスヘッダー
  if (options.responseHeaders.length > 0 && request.response?.headers) {
    mapping.response.headers = {}
    for (const header of options.responseHeaders) {
      if (request.response.headers[header]) {
        mapping.response.headers[header] = request.response.headers[header]
      }
    }
  }

  // レスポンスボディ
  if (request.response?.body) {
    try {
      mapping.response.jsonBody = JSON.parse(request.response.body)
    } catch {
      mapping.response.body = request.response.body
    }
  }

  // テンプレーティング
  if (options.enableTemplating) {
    mapping.response.transformers = ['response-template']
  }

  return mapping
}
```

## フィルタリング実装

WireMock APIは `since`, `limit` のみサポートするため、URL/method/statusフィルタはフロントエンド側で実装。

```typescript
// RequestsView.vue
const filteredRequests = computed(() => {
  return requests.value.filter(r => {
    // URLフィルタ
    if (filter.urlPattern && !r.request.url.includes(filter.urlPattern)) {
      return false
    }
    // メソッドフィルタ
    if (filter.method && r.request.method !== filter.method) {
      return false
    }
    // ステータスフィルタ
    const status = r.response?.status || r.responseDefinition?.status
    if (filter.statusFrom && status < filter.statusFrom) {
      return false
    }
    if (filter.statusTo && status > filter.statusTo) {
      return false
    }
    return true
  })
})
```

## エラーハンドリング

| エラーケース | 対応 |
|-------------|------|
| WireMockインスタンス応答なし | `ElMessage.error('WireMockに接続できません')` + 再試行ボタン |
| 記録が見つからない (404) | `ElMessage.error('記録が見つかりません')` + 一覧に戻る |
| 記録が0件 | Empty state表示 |
| インポート失敗 | エラーメッセージ表示 |

## i18n対応

`packages/frontend/src/i18n/ja.json` と `en.json` に以下を追加:

```json
{
  "requests": {
    "detail": "詳細",
    "importAsStub": "スタブとしてインポート",
    "filter": {
      "urlPattern": "URLパターン",
      "method": "メソッド",
      "statusFrom": "ステータス（から）",
      "statusTo": "ステータス（まで）",
      "apply": "適用",
      "reset": "リセット"
    },
    "import": {
      "title": "スタブとしてインポート",
      "stubName": "スタブ名",
      "urlMatchType": "URLマッチング方式",
      "matchHeaders": "マッチングするヘッダー",
      "bodyMatchType": "ボディマッチング方式",
      "responseHeaders": "レスポンスに含めるヘッダー",
      "enableTemplating": "レスポンステンプレーティングを有効化",
      "sensitiveDataWarning": "機密データが含まれています"
    }
  }
}
```

## 実装順序

### Step 1: 型定義の更新
- `LoggedRequest` 型を実際のAPIに合わせて拡張

### Step 2: 記録一覧のフィルタ機能
- `RequestFilter.vue` コンポーネント作成
- `RequestsView.vue` にフィルタ統合

### Step 3: 記録詳細画面
- `RequestDetailView.vue` 作成
- ルーティング追加
- `RequestTable.vue` に行クリックイベント追加

### Step 4: スタブインポート機能
- Backend: インポートAPIエンドポイント追加
- Frontend: `ImportStubDialog.vue` 作成
- マッピングJSON生成ロジック実装

### Step 5: E2Eテスト
- 記録一覧・詳細・インポートのテスト追加

### Step 6: i18n対応
- 日本語・英語メッセージ追加
