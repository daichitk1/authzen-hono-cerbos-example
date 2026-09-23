import type { ResultState } from './presentation.js'

export type TechnicalDetailsProps = {
  hasEvaluation: boolean
  result: ResultState
}

const formatJson = (value: unknown): string => JSON.stringify(value, null, 2)

export const TechnicalDetails = ({
  hasEvaluation,
  result,
}: TechnicalDetailsProps) => {
  const authzenRequest = result?.body.authzenRequest
  const authzenResponse =
    result !== null && 'authzenResponse' in result.body
      ? result.body.authzenResponse
      : null

  return (
    <details className="log-section" aria-labelledby="details-heading">
      <summary className="log-heading">
        <h2 id="details-heading">技術情報を見る</h2>
        <span className="details-toggle">開く</span>
      </summary>

      <div className="technical-metadata">
        <dl className="result-metadata">
          <div>
            <dt>HTTP STATUS</dt>
            <dd>{result === null ? '—' : `HTTP ${result.httpStatus}`}</dd>
          </div>
          <div>
            <dt>REQUEST ID</dt>
            <dd>
              <code className="request-id">
                {result?.body.requestId ?? '—'}
              </code>
            </dd>
          </div>
        </dl>

        <p className="request-flow" aria-label="認可の処理フロー">
          <span>操作を制御するアプリ（Hono）</span>
          <b aria-hidden="true">→</b>
          <span>AuthZEN</span>
          <b aria-hidden="true">→</b>
          <span>判定サービス（Cerbos）</span>
          <b aria-hidden="true">→</b>
          <span>判定をアプリへ反映</span>
        </p>
      </div>

      <div className="log-grid">
        <section aria-label="AuthZEN リクエスト" className="log-panel">
          <header>
            <h3>AuthZEN Request</h3>
            <code>PEP → PDP</code>
          </header>
          <pre>
            <code>
              {authzenRequest === undefined
                ? '// まだリクエストは送信されていません'
                : formatJson(authzenRequest)}
            </code>
          </pre>
        </section>

        <section aria-label="PDP の応答" className="log-panel">
          <header>
            <h3>PDP Response</h3>
            <code>PDP → PEP</code>
          </header>
          <pre>
            <code>
              {authzenResponse === null
                ? hasEvaluation
                  ? '// PDPから応答データは返されませんでした'
                  : '// まだ応答は受信していません'
                : formatJson(authzenResponse)}
            </code>
          </pre>
        </section>
      </div>
    </details>
  )
}
