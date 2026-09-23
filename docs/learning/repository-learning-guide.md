# AuthZEN Hono Cerbos Demo Repository Walkthrough

<!-- markdownlint-disable MD024 MD025 -->

## この教材の目的

この教材は、`authzen-hono-cerbos-example` の実装を**コードが実行される順番ではなく、理解しやすい依存関係の順番**で読むためのものです。

最終的には、次を自分の言葉で説明できる状態を目指します。

```text
誰が操作しようとしているのか
  ↓
何を操作しようとしているのか
  ↓
どのActionなのか
  ↓
HonoがAuthZEN Requestをどう作るのか
  ↓
CerbosがどのPolicyをどう評価するのか
  ↓
HonoがDecisionをどう強制するのか
```

---

# 第1章 Repository全体像

## 理解すること

最初はコードを細かく読まず、役割だけ分けます。

```text
React
= 入力と結果の可視化

Hono
= PEP
= 認可判断に必要な情報を集め、PDPへ問い合わせ、結果を強制する

AuthZEN
= PEPとPDPの間で認可要求とDecisionを交換する共通形式

Cerbos
= PDP
= Policyを評価してDecisionを返す

Cerbos Policy
= どんな条件ならALLOWするかを書く
```

## 読むファイル

1. `README.md`
2. `docs/design.md`

## 見るポイント

次のArchitectureを頭に入れます。

```text
Browser
  ↓
Hono API = PEP
  ↓
createAuthZenClient()が返したevaluate()
  ↓ POST /access/v1/evaluation
Cerbos = PDP
  ↓
Document Resource Policy
  ↓
Decision
  ↓
Honoが強制
```

## 確認問題

- AuthZEN自身がOwner判定をするでしょうか。
- HonoとCerbosのどちらがPEPでしょうか。
- PolicyはHonoとCerbosのどちらに置かれているでしょうか。

## 完了条件

`Hono = PEP`、`Cerbos = PDP`、`AuthZEN = 両者のAPI境界`を説明できる。

---

# 第2章 Domainを先に理解する

## 理解すること

認可コードを読む前に、このDemoに登場するSubject、Resource、Actionを固定します。

## 読むファイル

`packages/domain/src/index.ts`

## Demoの登場人物

```text
Yuki
- role: user
- Document Owner

Ren
- role: user
- Non-owner

Admin
- role: admin
```

Resourceは1件です。

```text
Document
id = document-123
ownerId = yuki
```

Actionは3つです。

```text
read
update
delete
```

## コードを見るポイント

- `documentActions`
- `demoSubjects`
- `demoDocument`
- `findDemoSubject()`
- `findDemoDocument()`

この段階ではAuthZENもCerbosも考えません。

まず、**認可判断へ渡す材料の元データ**だけを理解します。

## 確認問題

- RenとYukiはRoleが違いますか。
- YukiとRenの`update`結果を分けるには、Role以外に何が必要でしょうか。

## 完了条件

Yuki / Ren / Admin / document-123 / read / update / deleteを何も見ず説明できる。

---

# 第3章 権限表を理解する

## 理解すること

Policyコードを見る前に、人間の言葉で権限要件を確定します。

| Subject |  read | update | delete |
| ------- | ----: | -----: | -----: |
| Yuki    | ALLOW |  ALLOW |  ALLOW |
| Ren     | ALLOW |   DENY |   DENY |
| Admin   | ALLOW |  ALLOW |  ALLOW |

文章にすると3ルールです。

1. `user`と`admin`はDocumentをreadできる。
2. `user`はOwnerの場合だけupdate/deleteできる。
3. `admin`はOwnerでなくてもupdate/deleteできる。

## なぜ先に表を見るのか

Cerbos Policyは権限要件そのものを発明するものではありません。

```text
人間が決めた権限要件
  ↓
Cerbos Policyとして表現
```

という順番です。

## 確認問題

- Renがupdateできない理由は「user Roleだから」ですか。
- AdminにはOwner判定が必要ですか。

## 完了条件

3つのRuleを日本語で説明できる。

---

# 第4章 Cerbos Resource Policy

## 読むファイル

`cerbos/policies/document.yaml`

## 理解すること

このファイルは、Documentに対する認可Ruleを持ちます。

見る順番は次です。

```text
resource
  ↓
rules
  ↓
actions
  ↓
roles
  ↓
condition
  ↓
effect
```

### read Rule

```text
action = read
role = user / admin
→ ALLOW
```

### Owner Rule

```text
action = update / delete
role = user
condition:
ownerId == principal.id
→ trueならALLOW
```

### Admin Rule

```text
action = update / delete
role = admin
→ ALLOW
```

## 最重要ポイント

Owner判定は次の比較です。

```text
request.resource.attr.ownerId
==
request.principal.id
```

Yukiなら、

```text
yuki == yuki
→ true
```

Renなら、

```text
yuki == ren
→ false
```

該当するALLOW RuleがなければDENYになります。

## 確認問題

- Ren + updateでは、ActionとRoleの条件は一致しますか。
- それでもDENYになるのはどの条件が不一致だからでしょうか。

## 完了条件

`document.yaml`を上から読んで、Yuki / Ren / Adminの結果を予測できる。

---

# 第5章 AuthZENの情報モデル

## 読むファイル

`packages/contracts/src/authzen.ts`

## 理解すること

Access Evaluation Requestの中心は次です。

```text
Subject
Action
Resource
Context（任意）
```

このDemoなら、

```text
Subject
= yuki

Action
= update

Resource
= document-123
```

です。

Owner判定には追加属性が必要なので、Resource propertiesへ`ownerId`を載せます。

```json
{
  "resource": {
    "type": "document",
    "id": "document-123",
    "properties": {
      "ownerId": "yuki"
    }
  }
}
```

Responseの中心はboolean Decisionです。

```json
{
  "decision": true
}
```

または、

```json
{
  "decision": false
}
```

## 確認問題

- `ownerId`はAuthZENが意味を決めた標準Propertyでしょうか。
- `decision: false`は通信エラーでしょうか。

## 完了条件

Access Evaluation Requestを日本語の質問へ戻せる。

---

# 第6章 AuthZENからCerbosへのMapping

## 理解すること

AuthZENのEntityがCerbos内部でどう見えるかをつなぎます。

```text
subject.id
→ principal.id

subject.properties.cerbos.roles
→ principal.roles

resource.type
→ resource.kind

resource.properties.ownerId
→ resource.attr.ownerId

action.name
→ Cerbos action
```

## 注意

`cerbos.roles`はこのCerbos Mappingで使うPropertyです。

AuthZEN全体で共通のRole Propertyだとは考えません。

## Yuki + updateを変換する

AuthZEN側:

```text
subject.id = yuki
subject.properties.cerbos.roles = [user]
action.name = update
resource.type = document
resource.properties.ownerId = yuki
```

Cerbos側:

```text
principal.id = yuki
principal.roles = [user]
action = update
resource.kind = document
resource.attr.ownerId = yuki
```

これで第4章のPolicy評価へ接続できます。

## 完了条件

AuthZEN RequestのFieldを見て、Cerbos Policy内のどこで使われるか説明できる。

---

# 第7章 ContractとZod Runtime Validation

## 読むファイル

```text
packages/contracts/src/authzen.ts
apps/api/src/authzen/client.ts
```

## 理解すること

TypeScriptの型宣言と、外部から届いたJSONが正しいことは別問題です。

```text
TypeScript
AccessEvaluationResponse型

≠

PDPが実際に返したJSONが必ず正しい
```

そのため、このRepositoryではZod SchemaをRuntime Validationの正とします。

```ts
export const accessEvaluationResponseSchema = z.object({
  decision: z.boolean(),
  context: z.record(z.string(), z.unknown()).optional(),
})
```

TypeScript型も同じSchemaから生成します。

```ts
export type AccessEvaluationResponse = z.infer<
  typeof accessEvaluationResponseSchema
>
```

PDPから返ったJSONは最初は`unknown`として扱い、`safeParse()`で検証します。

```ts
const result = accessEvaluationResponseSchema.safeParse(payload)

if (!result.success) {
  throw createAuthZenClientError(
    'INVALID_RESPONSE',
    'PDP returned a payload without a valid boolean Decision',
    { cause: result.error },
  )
}

return result.data
```

## なぜ必要か

PDP ResponseはHonoプロセスの外から届く入力だからです。

`decision: false`は正常なPolicy DENYなのでValidationに成功します。

一方、次は`decision`がbooleanではないためValidationに失敗します。

```json
{
  "decision": "true"
}
```

## 確認問題

- TypeScript型だけでPDPのJSONを信用してよいでしょうか。
- `safeParse()`に成功したDataだけを使う理由は何でしょうか。
- `{ "decision": false }`と`{ "decision": "false" }`の違いは何でしょうか。

## 完了条件

「外部JSONはZodでRuntime Validationし、検証済みDataだけを認可Decisionとして使う」と説明できる。

---

# 第8章 createAuthZenClient()

## 読むファイル

```text
apps/api/src/authzen/client.ts
apps/api/src/authzen/errors.ts
```

## 理解すること

`createAuthZenClient()`が生成するclientの仕事はPolicy判断ではありません。

```text
Hono
  ↓
createAuthZenClient()が返したevaluate()
  ↓ HTTP
Cerbos
```

という**通信境界**を担当します。

`createAuthZenClient()`はBase URL、Timeout、`fetch`実装をclosureへ閉じ込め、`evaluate()`を持つplain objectを返します。

主な仕事:

1. `/access/v1/evaluation`へPOSTする。
2. JSON Requestを送る。
3. `X-Request-ID`を送る。
4. Timeoutを設定する。
5. non-2xxをErrorとして扱う。
6. JSONをparseする。
7. ResponseをZodでRuntime Validationする。

## DENYとの違い

ここが重要です。

```text
HTTP 200
{ decision: false }

→ PDPは評価できた
→ Policy DENY
```

一方、

```text
Timeout
HTTP 500
Invalid JSON
Invalid payload
Network error

→ 認可評価を正常完了できなかった
```

です。

## 完了条件

`createAuthZenClient()`の実装にOwner判定が書かれていない理由を説明できる。

---

# 第9章 PEPの信頼境界

## 読むファイル

`apps/api/src/pep/types.ts`

合わせて`docs/security/boundaries.md`も確認します。

## 理解すること

PDPが正しくても、PEPが嘘の属性を送れば正しい認可になりません。

このDemoでは、認可材料を次のように扱います。

```text
subject.id
← Server側で解決したDemo Subject

role
← Server-side Subject record

action
← Server側Allowlist

resource
← Server-side Document record

ownerId
← Server-side Document record
```

重要なのは、RoleやownerIdをClientの自己申告として信用しないことです。

## 完了条件

「なぜPEPのAttribute収集も認可設計の一部なのか」を説明できる。

---

# 第10章 demoAuthenticate

## 読むファイル

`apps/api/src/middleware/demo-authenticate.ts`

## 理解すること

このMiddlewareはSubjectを確定します。

```text
X-Demo-Subject: yuki
  ↓
findDemoSubject()
  ↓
Server側Subject record
  ↓
c.set('currentUser', subject)
```

これは本番Authenticationではありません。

Demoでは、Yuki / Ren / Adminの認可差を見せるため固定Mapを利用しています。

本番なら、Session / JWT / OIDCなどを検証した結果からUserやRoleを解決する想定です。

## 見るポイント

Clientが送るのはSubject IDです。

Role ArrayそのものをClientから受け取っていないことを確認します。

## 完了条件

`X-Demo-Subject`と本番Authenticationを混同せず説明できる。

---

# 第11章 loadDocument

## 読むファイル

`apps/api/src/middleware/load-document.ts`

## 理解すること

このMiddlewareはResourceを確定します。

```text
URL parameter
id = document-123
  ↓
findDemoDocument()
  ↓
Server-side Document
  ↓
ownerId = yuki
  ↓
c.set('document', document)
```

Owner判定に使う`ownerId`はここで取得したServer側Dataです。

Request Bodyから、

```json
{
  "ownerId": "自分のID"
}
```

のように自己申告させる設計にはしていません。

## 完了条件

なぜ`loadDocument`が認可より前に必要なのか説明できる。

---

# 第12章 authorizeDocument

## 読むファイル

`apps/api/src/middleware/authorize-document.ts`

このRepositoryで最も重要なファイルです。

## 読む順番

### 1. Actionを検証

```text
rawAction
  ↓
isDocumentAction()
```

未知のActionはPDPへ送る前に400で拒否します。

### 2. Contextから認可材料を取得

```text
currentUser
Document
Action
```

### 3. AuthZEN Requestを作る

```text
Subject
Action
Resource
```

へ変換します。

### 4. PDPへ問い合わせる

```text
authorizationClient.evaluate()
```

### 5. PDP Error

通信・Payloadなどで評価できなければ、Business処理へ進みません。

```text
NOT_EVALUATED
HTTP 503
```

### 6. Policy DENY

```text
decision: false
  ↓
HTTP 403
```

### 7. ALLOW

```text
decision: true
  ↓
c.set(...)
  ↓
await next()
```

**`next()`へ進めるのはALLOWだけ**です。

## Fail Closed

PDPが止まっていて「許可か拒否か分からない」状態でも、操作を許可しません。

```text
判定不能
→ ALLOWにしない
→ Handlerへ進めない
```

これがこのDemoでのFail Closedです。

## 完了条件

`authorizeDocument.ts`を見ずに、7段階の流れを説明できる。

---

# 第13章 Hono Route全体をつなぐ

## 読むファイル

`apps/api/src/index.ts`

## 理解すること

ここまで理解してからRouteを見ると、Middlewareの順番自体がPEPの処理になります。

```text
POST /api/demo/documents/:id/actions/:action

  ↓
demoAuthenticate
Subjectを確定

  ↓
loadDocument
ResourceとownerIdを確定

  ↓
authorizeDocument
AuthZEN → Cerbos → Decision強制

  ↓
Handler
ALLOW時だけ実行
```

このDemoでは実際のDocument更新・削除は行わず、OperationをSimulationします。

認可フローの確認にScopeを絞るためです。

## 確認問題

Middlewareの順番を、

```text
loadDocument
→ demoAuthenticate
```

へ入れ替える必要はあるでしょうか。

重要なのは、`authorizeDocument`より前にSubjectとResourceが確定していることです。

## 完了条件

`apps/api/src/index.ts`のRouteを1行ずつ役割説明できる。

---

# 第14章 React UIは最後に読む

## 読むファイル

`apps/web/src/App.tsx`

## 理解すること

UIは認可判断そのものを行いません。

役割は、

```text
Subjectを選ぶ
Actionを選ぶ
  ↓
HonoへRequest
  ↓
結果を表示
```

です。

表示する主な情報:

- ALLOW / DENY / NOT_EVALUATED
- HTTP Status
- Request ID
- AuthZEN Request
- AuthZEN Response

UIを最後に読む理由は、認可ロジックの本体がHonoとCerbosにあるためです。

## 見るポイント

画面でRen + updateを実行したとき、

```text
UI
→ DENYを表示
```

しますが、そのDENYを決めたのはReactではありません。

## 完了条件

UI / PEP / PDPの責務を混同せず説明できる。

---

# 第15章 Testで理解を確定する

## 読む順番

```text
1. Cerbos Policy Test
2. createAuthZenClient() Unit Test
3. Hono PEP Test
4. Hono + Cerbos Integration Test
5. PDP failure Test
6. Playwright E2E
```

Repositoryでは、Policy DENYとPDP Errorを分けて検証します。

期待する主要ケース:

| Subject | Action | Result |
| ------- | ------ | ------ |
| Yuki    | read   | ALLOW  |
| Yuki    | update | ALLOW  |
| Ren     | update | DENY   |
| Ren     | delete | DENY   |
| Admin   | update | ALLOW  |
| Admin   | delete | ALLOW  |

さらにCerbos停止時には、

```text
PDP停止
  ↓
認可評価不能
  ↓
HTTP 503
  ↓
Business Handlerは実行されない
```

ことを確認します。

## 最終確認問題

次の質問へ答えてください。

1. AuthZENはPolicy言語でしょうか。
2. `subject.properties.cerbos.roles`はAuthZEN標準のRole表現でしょうか。
3. Ren + updateがDENYになるまでを説明してください。
4. `decision: false`とPDP Timeoutの違いは何でしょうか。
5. `ownerId`をClient Request Bodyから使ってはいけない理由は何でしょうか。
6. なぜ`authorizeDocument`はALLOWのときだけ`next()`するのでしょうか。
7. Cerbos停止中に処理を止める設計を何と呼んでいるでしょうか。

## 最終到達点

次の一本を、実際のファイル名を挙げながら説明できればRepository理解は完了です。

```text
packages/domain
Subject / Resource / Actionを定義
  ↓
cerbos/policies/document.yaml
権限要件をPolicy化
  ↓
packages/contracts/src/authzen.ts
AuthZEN Request / Responseを定義
  ↓
apps/api/src/authzen/client.ts
createAuthZenClient()でPDP通信clientを生成
  ↓
demo-authenticate.ts
Subjectを確定
  ↓
load-document.ts
ResourceとownerIdを確定
  ↓
authorize-document.ts
Request生成・PDP問い合わせ・Decision強制
  ↓
apps/api/src/index.ts
MiddlewareをPEPとして接続
  ↓
apps/web/src/App.tsx
結果を可視化
  ↓
tests/
ALLOW / DENY / Fail Closedを検証
```

---

# 学習時のおすすめ方法

一度に全部読まず、各章で次を繰り返してください。

```text
教材を読む
  ↓
対象ファイルを開く
  ↓
コメントを読みながらコードを追う
  ↓
教材を閉じる
  ↓
自分の言葉で説明する
  ↓
確認問題へ答える
```

特に第4章、第6章、第12章、第13章を説明できるようになると、Hono + AuthZEN + Cerbosの中心フローがつながります。
