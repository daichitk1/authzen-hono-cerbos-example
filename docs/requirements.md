# Product Requirements

## 1. Purpose

HonoをPolicy Enforcement Point、CerbosをPolicy Decision Pointとして利用し、AuthZEN Authorization APIのsingle Access Evaluationを確認できる最小PoCを作る。

利用者は固定されたSubjectとActionを選択し、同じDocumentに対するALLOW、DENY、PDP障害時の安全な停止を確認できる。

## 2. Demo entities

### Subject

| ID      | Role    | Relation       |
| ------- | ------- | -------------- |
| `yuki`  | `user`  | Document owner |
| `ren`   | `user`  | Non-owner      |
| `admin` | `admin` | Administrator  |

### Resource

```text
Type: document
ID: document-123
Owner ID: yuki
```

### Permission matrix

| Subject | `read` | `update` | `delete` |
| ------- | -----: | -------: | -------: |
| Yuki    |  ALLOW |    ALLOW |    ALLOW |
| Ren     |  ALLOW |     DENY |     DENY |
| Admin   |  ALLOW |    ALLOW |    ALLOW |

## 3. Functional requirements

- `REQ-001`: HonoはAuthZENのsingle Access EvaluationをCerbosへ送信する。
- `REQ-002`: Demo SubjectはYuki、Ren、Adminから選択できる。
- `REQ-003`: Actionは`read`、`update`、`delete`に限定する。
- `REQ-004`: 固定Resource `document-123`のOwnerはYukiとする。
- `REQ-005`: 画面にDecision、HTTP Status、Request ID、AuthZEN Request、AuthZEN Responseを表示する。
- `REQ-006`: PDPが正常にDENYした場合はBusiness処理を実行しない。
- `REQ-007`: PDPが評価不能な場合もBusiness処理を実行せず、Policy Denyと区別する。
- `REQ-008`: 実際のDocument更新・削除は行わず、許可後の処理をSimulationする。

## 4. Security requirements

- `SEC-001`: RoleはClient入力をそのまま利用せず、Server側の信頼できる情報から解決する。
- `SEC-002`: `ownerId`はRequest BodyではなくServer側Resourceから取得する。
- `SEC-003`: ActionはServer側Allowlistで検証する。
- `SEC-004`: PDP Timeout、HTTP error、不正ResponseではFail Closedとする。
- `SEC-005`: Demo Identityと本番Authenticationを明確に区別する。

## 5. Scope

- React / Vite / TypeScriptの検証UI
- Hono / Node.js / TypeScript API
- CerbosをDockerで起動
- Document Resource Policy
- single Access Evaluation
- Unit、Integration、E2E、Fail Closed検証
- ローカル実行手順とE2Eによる動作確認

## 6. Non-scope

- 会員登録、本番Login、OAuth/OIDC
- mTLS、本番TLS終端
- PostgreSQL、Prisma、永続化
- Batch Evaluation、Search API
- Policy Editor
- 公開デプロイ
- 本物のDocument CRUD
