# AuthZEN Hono Cerbos Example

ReactからHonoのAPIを呼び、HonoがAuthZENのsingle Access EvaluationでCerbosへ認可判断を問い合わせるデモです。許可・拒否・PDP障害を画面で区別して確認できます。

| 読みたい内容                            | ページ                                    |
| --------------------------------------- | ----------------------------------------- |
| デモで確認する動作と範囲                | [要件定義](./requirements.md)             |
| React、Hono、Cerbosの役割と通信順序     | [設計](./design.md)                       |
| 画面から呼ぶAPIのリクエストとレスポンス | [ReactとHonoのAPI](./api/frontend-api.md) |
| 属性の出所と失敗時の扱い                | [信頼境界](./security/boundaries.md)      |
| コードを読む順番                        | [学習ガイド](./learning/README.md)        |

起動手順とテストコマンドは[README](https://github.com/daichitk1/authzen-hono-cerbos-example#readme)を参照してください。このサイトは静的な文書です。認可デモを試す場合はローカルでAPI、Web、Cerbosを起動してください。
