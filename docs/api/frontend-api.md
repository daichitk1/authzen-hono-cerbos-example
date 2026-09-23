# Frontend-facing Demo API

この文書は、React WebとHono APIの間で使うDemo用Application APIの仕様をまとめる。

AuthZEN Authorization APIそのものの仕様ではない。

```text
React Web
  ↓ Application API
Hono API / PEP
  ↓ AuthZEN Authorization API
Cerbos / PDP
```

React WebはCerbosを直接呼ばない。ReactからHonoへ操作対象を伝え、HonoがServer-side情報を補ってAuthZEN Access Evaluation Requestを組み立てる。

## 1. Honoが公開するRoute

Hono APIは次のRouteを公開する。

- `GET /health`
  - APIのHealth Check。
  - React評価フローでは使わず、ローカル/E2Eの起動確認に使用する。
- `POST /api/demo/documents/:id/actions/:action`
  - SubjectがDocumentへActionを実行できるか評価する。
  - React UIが認可評価時に使用する主要Endpoint。

以降は、Reactが実際に使用する認可評価Endpointを詳しく説明する。

## 2. Authorization Evaluation Endpoint

```http
POST /api/demo/documents/:id/actions/:action
```

このEndpointは、次の質問をHonoへ渡すためのApplication APIである。

```text
誰が？
→ Subject

何に対して？
→ Document

何をする？
→ Action
```

例えば、Yukiが`document-123`を`update`する場合は次のRequestになる。

```http
POST /api/demo/documents/document-123/actions/update
X-Demo-Subject: yuki
```

Request Bodyは使用しない。

## 3. Requestで渡す値

ReactからHonoへ渡す値は3つである。

### Subject ID

HTTP Headerの`X-Demo-Subject`で渡す。

```http
X-Demo-Subject: yuki
```

Demoで使用できる値は次の3つ。

```text
yuki
ren
admin
```

Clientが指定するのはSubject IDだけであり、Roleは送らない。

Honoの`demoAuthenticate`がSubject IDをServer-side mapで解決し、Roleを含む信頼済みSubjectをHono Contextへ保存する。

```text
X-Demo-Subject: yuki
  ↓
findDemoSubject("yuki")
  ↓
{
  id: "yuki",
  roles: ["user"]
}
```

### Document ID

URL Pathの`:id`で渡す。

```text
/api/demo/documents/document-123/actions/update
                    ^^^^^^^^^^^^
```

Clientが指定するのは「どのDocumentを操作したいか」というIDだけである。

`ownerId`などのResource属性はClientから送らない。

Honoの`loadDocument`がDocument IDをServer-side Resourceへ解決する。

```text
document-123
  ↓
findDemoDocument("document-123")
  ↓
{
  type: "document",
  id: "document-123",
  ownerId: "yuki"
}
```

### Action

URL Pathの`:action`で渡す。

```text
/api/demo/documents/document-123/actions/update
                                         ^^^^^^
```

Demoで使用できるActionは次の3つ。

```text
read
update
delete
```

Honoは受け取った文字列をそのままPDPへ送らず、Server-side allowlistで検証する。

## 4. Request Bodyを使わない理由

現在の評価EndpointではRequest Bodyを使用しない。

特に、次のような認可属性をClientから受け取らない。

```json
{
  "role": "admin",
  "ownerId": "yuki"
}
```

認可判断に使う重要属性の情報源は次のように分離する。

```text
subject.id
← Clientが指定したIDをServer側で解決

subject role
← Server-side Subject record

resource.id
← Clientが指定したIDをServer側で解決

resource ownerId
← Server-side Document record

action
← Client指定値 + Server-side allowlist
```

Clientは「誰が、どのResourceへ、どのActionをしたいか」を指定できるが、RoleやOwner情報そのものは決められない。

## 5. Hono内部の処理順

Requestを受け取ったHonoは次の順番で処理する。

```text
POST /api/demo/documents/:id/actions/:action
  ↓
demoAuthenticate
Subject IDをServer-side Subjectへ解決
  ↓
loadDocument
Document IDをServer-side Documentへ解決
  ↓
authorizeDocument
Actionをallowlistで検証
  ↓
Subject + Action + ResourceからAuthZEN Requestを作成
  ↓
createAuthZenClient()が返したevaluate()
  ↓
POST /access/v1/evaluation
  ↓
Cerbos
```

Application APIとAuthZEN APIは別のHTTP通信である。

```text
React Web
  ↓
POST /api/demo/documents/document-123/actions/update
  ↓
Hono API
  ↓
POST /access/v1/evaluation
  ↓
Cerbos
```

## 6. Honoが組み立てるAuthZEN Request

Yukiが`document-123`を`update`する場合、HonoはServer-side情報を使って概ね次のRequestを作る。

```json
{
  "subject": {
    "type": "user",
    "id": "yuki",
    "properties": {
      "cerbos.roles": ["user"]
    }
  },
  "action": {
    "name": "update"
  },
  "resource": {
    "type": "document",
    "id": "document-123",
    "properties": {
      "ownerId": "yuki"
    }
  }
}
```

ReactがこのAuthZEN Requestを直接作るわけではない。

## 7. ALLOW Response

Cerbosが`decision: true`を返した場合、HonoはBusiness Handlerへ進み、HTTP `200`を返す。

```json
{
  "decision": "ALLOW",
  "requestId": "request-id",
  "authzenRequest": {
    "subject": {},
    "action": {},
    "resource": {}
  },
  "authzenResponse": {
    "decision": true
  },
  "simulatedOperation": {
    "subject": "yuki",
    "action": "update",
    "resource": "document-123",
    "status": "simulated"
  }
}
```

`authzenRequest`の省略部分には、実際にCerbosへ送ったSubject、Action、Resourceが入る。

このPoCでは実際のDocument更新・削除は行わず、Business処理をSimulationする。

## 8. DENY Response

Cerbosが正常にPolicyを評価して`decision: false`を返した場合、HonoはHTTP `403`を返す。

```json
{
  "decision": "DENY",
  "requestId": "request-id",
  "authzenRequest": {
    "subject": {},
    "action": {},
    "resource": {}
  },
  "authzenResponse": {
    "decision": false
  }
}
```

これは通信障害ではなく、正常に完了したPolicy Denyである。

Business Handlerへは進まない。

## 9. NOT_EVALUATED Response

Timeout、PDPのHTTP Error、Network Error、不正JSON、不正Payloadなどで認可評価を完了できなかった場合、HonoはHTTP `503`を返す。

```json
{
  "decision": "NOT_EVALUATED",
  "reason": "PDP_UNAVAILABLE",
  "requestId": "request-id",
  "authzenRequest": {
    "subject": {},
    "action": {},
    "resource": {}
  }
}
```

この状態ではPDP Decisionが存在しないため、`authzenResponse`は含めない。

Business Handlerへも進まず、Fail Closedとする。

## 10. Application-level Error

### Invalid Action

許可されたAction以外を指定した場合はHTTP `400`。

```json
{
  "error": "INVALID_ACTION"
}
```

### Invalid Demo Subject

`X-Demo-Subject`が存在しない、またはDemo Subjectとして解決できない場合はHTTP `401`。

```json
{
  "error": "UNAUTHENTICATED_DEMO_SUBJECT",
  "message": "X-Demo-Subject must be yuki, ren, or admin."
}
```

### Document Not Found

指定したDocument IDをServer-side Resourceへ解決できない場合はHTTP `404`。

```json
{
  "error": "DOCUMENT_NOT_FOUND"
}
```

## 11. HTTP Status Summary

```text
200
PDP Allow。Simulation handlerを実行する。

400
Actionが不正。

401
Demo Subjectを確定できない。

403
PDPが正常に評価した結果のDeny。

404
Documentが存在しない。

503
PDPで認可評価を完了できない。
```

## 12. 現在のReact UIとの対応

現在のReact UIではSubjectとActionを選択できる。

DocumentはDemo Resourceの`document-123`に固定されている。

```text
Subject
→ Yuki / Ren / Adminから選択

Document
→ document-123固定

Action
→ read / update / deleteから選択
```

Evaluate時には次の入力を`evaluateAccess`へ渡す。

```text
subjectId
→ 選択したSubject

documentId
→ demoDocument.id

action
→ 選択したAction
```

`evaluateAccess`がこれらをHTTP HeaderとURL Pathへ変換してHono APIを呼ぶ。

## 13. 関連実装

```text
apps/web/src/api/evaluate-access.ts
ReactからHono APIを呼ぶClient

apps/api/src/index.ts
Hono Route定義

apps/api/src/middleware/demo-authenticate.ts
Subject解決

apps/api/src/middleware/load-document.ts
Resource解決

apps/api/src/middleware/authorize-document.ts
AuthZEN Request生成、PDP問い合わせ、Decision強制

apps/api/src/authzen/client.ts
createAuthZenClient() factoryとHonoからCerbosへのAuthZEN通信

packages/contracts/src/authorization.ts
HonoからReactへ返す評価Response Contract
```
