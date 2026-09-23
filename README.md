# AuthZEN Hono Cerbos Example

HonoをPolicy Enforcement Point（PEP）、CerbosをPolicy Decision Point（PDP）として利用し、OpenID AuthZEN Authorization APIのsingle access evaluationを実際に確認するための学習用PoCです。

このRepositoryでは、単に`decision: true / false`を返すだけでなく、**どの属性をPEPが信頼し、どのRequestをPDPへ送り、ALLOW / DENY / PDP障害をどのように強制するか**まで検証します。

## 学習ガイド

実装を理解する目的なら、[Repository Learning Path](docs/learning/README.md) から始めてください。

`Domain → Cerbos Policy → AuthZEN Contract → createAuthZenClient() → Hono Middleware → Route → UI → Test` の順に、実際のファイルと対応させて学習できます。

## このRepositoryで確認できること

- HonoがPEPとしてSubject、Action、Resourceを組み立てる
- `createAuthZenClient()`で生成したclientが`POST /access/v1/evaluation`でCerbosへ問い合わせる
- Cerbos Resource PolicyがOwner / Non-owner / Adminを評価する
- Policy DENYはHTTP 403としてBusiness処理を止める
- PDPのHTTP error、invalid JSON、invalid payload、timeout、停止はHTTP 503としてFail Closedにする
- Browser UIでAuthZEN Request / Response、Decision、HTTP Status、Request IDを確認する
- 実Cerbos、Hono、Reactを接続したIntegration / E2Eを再現する

## Architecture

```text
Browser
  ↓ Subject ID / Action
React Authorization Evaluation Tool
  ↓ HTTP
Hono API = PEP
  ├─ Demo SubjectをServer-side mapで解決
  ├─ DocumentをServer-side recordから取得
  ├─ Action allowlistを検証
  └─ AuthZEN Requestを構築
        ↓ POST /access/v1/evaluation
Cerbos = PDP
        ↓
Document Resource Policy
        ↓
ALLOW / DENY
        ↓
HonoがDecisionを強制
```

AuthZENはPEPとPDPの通信境界を標準化します。このPoCで使うCerbos Policy言語や`subject.properties.cerbos.roles`のMappingはCerbos固有です。

## Permission matrix

固定Resourceは`document-123`、OwnerはYukiです。

| Subject | Role    | `read` | `update` | `delete` |
| ------- | ------- | -----: | -------: | -------: |
| Yuki    | `user`  |  ALLOW |    ALLOW |    ALLOW |
| Ren     | `user`  |  ALLOW |     DENY |     DENY |
| Admin   | `admin` |  ALLOW |    ALLOW |    ALLOW |

未知のActionはServer-side allowlistで拒否されます。

## Requirements

- Node.js 22.18以上（`.nvmrc`は22.23.2）
- Corepack
- pnpm 11.20.0
- Docker Engine + Docker Compose

## Fresh clone setup

```bash
git clone https://github.com/daichitk1/authzen-hono-cerbos-example.git
cd authzen-hono-cerbos-example
nvm use
corepack enable
pnpm install
cp .env.example .env
```

最初にRepository gateを実行できます。

```bash
pnpm check
```

## 起動方法

### 1. Cerbos

```bash
pnpm cerbos:up
```

- HTTP: `http://127.0.0.1:3592`
- AuthZEN single evaluation: `POST /access/v1/evaluation`

### 2. Hono API

別Terminalで実行します。

```bash
pnpm dev:api
```

- API: `http://127.0.0.1:8787`
- Health: `GET /health`

### 3. React UI

さらに別Terminalで実行します。

```bash
pnpm dev:web
```

Browserで`http://127.0.0.1:5173`を開きます。ViteはLocal development時の`/api` RequestをHonoへproxyします。

## UIで再現する主要Scenario

### Yuki + update → ALLOW

1. Subjectに`Yuki`を選択する
2. Actionに`update`を選択する
3. `この条件で判定する`を押す
4. `ALLOW`、HTTP 200、Request ID、AuthZEN Request / Responseを確認する
5. `操作を続行します`が表示されることを確認する

### Ren + update → DENY

1. Subjectを`Ren`へ変更する
2. Actionは`update`のまま`この条件で判定する`を押す
3. `DENY`、HTTP 403を確認する
4. PDP responseが`decision: false`であることを確認する
5. Business operationが実行されないことを確認する

### Admin + delete → ALLOW

1. Subjectを`Admin`へ変更する
2. Actionを`delete`へ変更する
3. `この条件で判定する`を押す
4. `ALLOW`、HTTP 200を確認する

## Screenshot evidence

`pnpm test:e2e`を実行すると、Playwrightが`docs/evidence/`へ画面のScreenshotを生成します。生成した画像はGit管理せず、GitHub Actionsでは短期間のArtifactとして保存します。

## APIから直接確認する

YukiがDocumentをupdateする例です。

```bash
curl -sS \
  -X POST \
  -H 'X-Demo-Subject: yuki' \
  http://127.0.0.1:8787/api/demo/documents/document-123/actions/update
```

Renへ変更すると同じResource / Actionでも403になります。

```bash
curl -i \
  -X POST \
  -H 'X-Demo-Subject: ren' \
  http://127.0.0.1:8787/api/demo/documents/document-123/actions/update
```

## Fail Closedを再現する

APIとWebを起動したままCerbosを停止します。

```bash
pnpm cerbos:down
```

その状態でYuki + updateを評価します。

```bash
curl -i \
  -X POST \
  -H 'X-Demo-Subject: yuki' \
  http://127.0.0.1:8787/api/demo/documents/document-123/actions/update
```

期待結果:

```text
HTTP 503
Decision: NOT_EVALUATED
Operation blocked
simulatedOperationなし
```

これはPolicy DENYとは別の状態です。PDPの評価が完了していないため、ALLOWとして処理を継続しません。

再開する場合:

```bash
pnpm cerbos:up
```

## Test commands

| Command                 | 内容                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm check`            | format / lint / docs links / typecheck / unit / app build / docs build |
| `pnpm check:docs`       | Markdownのrelative link / Screenshot存在確認                           |
| `pnpm cerbos:compile`   | Cerbos Resource Policyをcompile                                        |
| `pnpm test:cerbos`      | AuthZEN EndpointへPolicy matrixを送信                                  |
| `pnpm test:integration` | Hono + 実Cerbos + PDP failure boundary                                 |
| `pnpm test:e2e`         | ChromiumでUI / Request ID / axe / responsive / keyboard                |
| `pnpm test:fail-closed` | Cerbos停止状態で503かつBusiness handler未実行を確認                    |

GitHub ActionsではfastなRepository checkを先に実行し、成功後だけCerbos / Integration / Browserの重い検証を実行します。Browser E2Eで生成したScreenshotは`authorization-evidence` Artifactとして14日間保存します。

## AuthZEN Request example

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

今回のCerbos Mapping:

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

`cerbos.roles`はCerbos固有のMappingです。AuthZEN全体の標準Role Propertyではありません。

## Project structure

```text
apps/
  web/          React / Vite / Authorization Evaluation Tool
  api/          Hono / PEP Middleware / AuthZEN client factory
packages/
  contracts/    API and AuthZEN contracts
  domain/       Demo Subject / Document / Action
cerbos/
  policies/     Document Resource Policy
docs/
  requirements.md
  design.md
  security/boundaries.md
  api/          ReactとHonoの間のAPI仕様
  learning/     コードを読むガイド
  evidence/     E2Eで生成するScreenshot（Git管理外）
tests/
  Hono / Cerbos Integration
  PDP failure / Fail Closed
  Playwright E2E
```

## Scope

- AuthZEN single Access Evaluation
- Hono PEP
- Cerbos PDP / Document Resource Policy
- React evaluation UI
- fixed Demo Subjects / Document
- Unit / Integration / E2E / Fail Closed
- Local developmentとE2Eによる動作確認

## Non-scope

- 本番Authentication、会員登録、OAuth / OIDC Login
- PostgreSQL、Prisma、永続化
- 本物のDocument CRUD
- Batch Evaluation / Search API
- mTLS、本番TLS終端
- PEPとPDP間の本番認証
- 公開デプロイ

## Security caveats

- `X-Demo-Subject`は本番Authenticationではありません。
- RoleはClientから受け取らず、Server-side fixed mapから解決します。
- `ownerId`はRequest BodyではなくServer-side Document recordから取得します。
- ActionはServer-side allowlistで検証します。
- PDP Responseは外部入力としてRuntime validationします。
- Policy DENYは403、PDP評価不能は503として区別します。
- Local HTTPはPoC用です。本番ではTLSとPEP認証を別途設計する必要があります。
- AuthZENはCerbos Resource Policy言語を標準化しません。

## References

### OpenID Foundation

- [Authorization API 1.0 Final Specification](https://openid.net/specs/authorization-api-1_0.html)
- [AuthZEN Specifications](https://openid.net/wg/authzen/specifications/)
- [Authorization API 1.0 Final Specification approved](https://openid.net/authorization-api-1-0-final-specification-approved/)

### Cerbos

- [Cerbos API / AuthZEN mapping](https://docs.cerbos.dev/cerbos/latest/api/index.html)
- [Cerbos blog — OpenID AuthZEN is official](https://www.cerbos.dev/blog/openid-authzen-is-official-cerbos-is-ready)

## Canonical documents

- [Product requirements](docs/requirements.md)
- [System design](docs/design.md)
- [Security boundaries](docs/security/boundaries.md)
- [Frontend API](docs/api/frontend-api.md)
- [Code guide](docs/learning/README.md)

これらの文書は[GitHub Pages](https://daichitk1.github.io/authzen-hono-cerbos-example/)でも読めます。Pagesには静的な文書だけを配信します。Repositoryの **Settings → Pages → Build and deployment → Source** は **GitHub Actions** を選択してください。

## ライセンス

現時点ではライセンス未設定です。コードの利用・改変・再配布を包括的に許諾するものではありません。
