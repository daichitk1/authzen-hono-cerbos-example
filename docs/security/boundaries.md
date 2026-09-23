# Security Boundaries

## 1. Trust boundary

認可判断は、PDPへ送る属性の信頼性に依存する。HonoはClientから届いた値をそのまま認可材料として扱わない。

| Value           | Trusted source                           | Rejected source             |
| --------------- | ---------------------------------------- | --------------------------- |
| `subject.id`    | Demo SubjectをServer側Mapで解決した結果  | 任意のUser object           |
| Subject roles   | Server側Map、将来は検証済みTokenまたはDB | Clientが送ったRole array    |
| `action.name`   | RouteとServer側Allowlist                 | 無制限の文字列              |
| `resource.id`   | 検証済みURL parameter                    | 未検証の任意値              |
| `ownerId`       | Server側Resource repository              | Request Bodyの自己申告      |
| Request context | Serverが取得した必要最小限の情報         | Clientが自由に作ったContext |

## 2. Authentication boundary

`X-Demo-Subject`は学習用のIdentity selectorであり、本番Authenticationではない。本番化するときはSession、JWT、OIDCなどを検証し、その結果からSubjectを作る。

## 3. PEP to PDP boundary

ローカルPoCではCerbosへHTTPで接続する。本番では通信のIntegrityとConfidentialityを確保するTLS、およびPEPを識別する認証を別途設計する。

## 4. Fail Closed

次の状態では認可評価が完了していないため、Business handlerへ進めない。

- Timeout
- Connection failure
- PDP 4xx / 5xx
- JSON parse failure
- `decision`がbooleanではないResponse

`decision: false`は正常に評価されたPolicy Denyであり、通信障害とは分けて記録する。

## 5. Cerbos-specific mapping boundary

`subject.properties.cerbos.roles`はCerbosがPrincipal RoleへMappingするための固有Propertyであり、AuthZEN全体の標準Role表現ではない。

本番のHono PEPでは、このPropertyへClientが送信したRoleをそのまま入れない。認証結果、検証済みToken、またはServer側DBから解決したRoleだけを設定する。

Documentの`ownerId`もClientのRequest Bodyから取得せず、Server側Repositoryが返したResource属性を使用する。

Policy Testで使うYuki、Ren、Adminと`ownerId: yuki`は固定fixtureであり、本番の信頼境界を代替するものではない。

## 6. PDP Response boundary

PDPのHTTP ResponseとJSON bodyは、TypeScript型が付いていても外部入力である。`response.json()`の結果を`unknown`として扱い、次をRuntimeで確認する。

- Response bodyがObjectである
- `decision`がbooleanである
- `context`が存在する場合はObjectである

`decision: false`は評価済みのPolicy Denyとして正常Responseに含める。non-2xx、Timeout、Network failure、JSON parse failure、不正Payloadは評価不能としてError分類し、PEPでFail Closedへ接続する。

## 7. Hono PEP enforcement boundary

PEPはClient入力と認可材料を分離する。

- Headerの`X-Demo-Subject`は固定Subjectを選択するIDとしてだけ使う。
- RoleはClientから受け取らず、Server-side Subject mapから取得する。
- Resource IDはURLから受け取るが、存在確認後のServer-side Document recordを使う。
- `ownerId`はRequest Bodyから受け取らず、Server-side Document recordから取得する。
- Actionは`read`、`update`、`delete`のallowlistに一致した値だけをPDPへ送る。
- Request BodyにRoleや`ownerId`が含まれていても認可材料として読まない。

PDPがALLOWした場合だけAuthorization TraceをHono Contextへ保存し、次のhandlerを実行する。Policy Denyまたは評価不能では`next()`を呼ばないため、Simulation処理は実行されない。

この設計はMiddlewareのinstruction boundaryであり、本番Authenticationを提供するものではない。本番では検証済みSession、JWT、OIDCなどからSubjectを構築する。
