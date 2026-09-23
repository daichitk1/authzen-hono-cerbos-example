# Repository Learning Path

`authzen-hono-cerbos-example` を、実装の依存関係に沿って理解するための学習入口です。

このRepositoryは、次の流れをコードで確認するためのPoCです。

```text
Browser
  ↓
Hono = PEP
  ↓ AuthZEN Authorization API
Cerbos = PDP
  ↓
Document Resource Policy
  ↓
ALLOW / DENY
  ↓
HonoがDecisionを強制
```

## 学習順

| 順番 | 学ぶこと                     | 主に読む場所                                    |
| ---: | ---------------------------- | ----------------------------------------------- |
|    1 | Repository全体像             | `README.md`, `docs/design.md`                   |
|    2 | Subject / Resource / Action  | `packages/domain/src/index.ts`                  |
|    3 | 権限要件                     | `cerbos/policies/document.yaml`                 |
|    4 | CerbosのPolicy評価           | `cerbos/policies/document.yaml`                 |
|    5 | AuthZENの情報モデル          | `packages/contracts/src/authzen.ts`             |
|    6 | AuthZEN → Cerbos Mapping     | Contract + Policy                               |
|    7 | ZodによるRuntime Validation  | `packages/contracts/src/authzen.ts`             |
|    8 | PDPとの通信                  | `apps/api/src/authzen/client.ts`                |
|    9 | PEPの信頼境界                | `apps/api/src/pep/types.ts`                     |
|   10 | Subjectの確定                | `apps/api/src/middleware/demo-authenticate.ts`  |
|   11 | Resourceの取得               | `apps/api/src/middleware/load-document.ts`      |
|   12 | 認可問い合わせとDecision強制 | `apps/api/src/middleware/authorize-document.ts` |
|   13 | MiddlewareをつないだPEP全体  | `apps/api/src/index.ts`                         |
|   14 | UIでの可視化                 | `apps/web/src/App.tsx`                          |
|   15 | Testで理解を確定             | `tests/`, `apps/api/src/*.test.ts`              |

## 教材

詳細は [Repository Walkthrough](./repository-learning-guide.md) を順番に進めてください。

各章には次を入れています。

- その章で理解すること
- 読むコード
- コードを見るポイント
- 自分で説明できるか確認する問題
- 次へ進むための完了条件

## 最終ゴール

最後に、次の一本の流れをコードを指しながら説明できれば完了です。

```text
Yukiがupdateを要求
  ↓
demoAuthenticateがSubjectを確定
  ↓
loadDocumentがDocumentとownerIdを取得
  ↓
authorizeDocumentがAuthZEN Requestを作成
  ↓
createAuthZenClient()が返したevaluate()でCerbosへPOST /access/v1/evaluation
  ↓
Cerbosがdocument Policyを評価
  ↓
decision: true / false
  ↓
HonoがALLOW / DENY / 評価不能を強制
  ↓
ALLOWの場合だけBusiness Handlerへ進む
```
