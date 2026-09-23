import { evaluateAccess, type EvaluateAccess } from './api/evaluate-access.js'
import { EvaluationPanel } from './evaluation/EvaluationPanel.js'
import { PolicyPanel } from './evaluation/PolicyPanel.js'
import { TechnicalDetails } from './evaluation/TechnicalDetails.js'
import { getEvaluationPresentation } from './evaluation/presentation.js'
import { useEvaluation } from './evaluation/use-evaluation.js'

export type AppProps = {
  evaluate?: EvaluateAccess
}

export const App = ({ evaluate = evaluateAccess }: AppProps) => {
  const evaluation = useEvaluation(evaluate)
  const presentation = getEvaluationPresentation({
    action: evaluation.action,
    isLoading: evaluation.isLoading,
    requestError: evaluation.requestError,
    result: evaluation.result,
    subjectId: evaluation.subjectId,
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="product-label">AuthZEN × Cerbos デモ</p>
        <h1>文書のアクセス権を確認</h1>
        <p className="lede">
          利用者と操作を選ぶと、設定されたルールに基づいて判定します。
        </p>
      </header>

      <div
        className={`main-grid ${presentation.hasEvaluation ? 'has-result' : 'is-ready'}`}
      >
        <PolicyPanel
          hasPolicyDecision={presentation.hasPolicyDecision}
          matchingRule={presentation.matchingRule}
        />
        <EvaluationPanel
          action={evaluation.action}
          isLoading={evaluation.isLoading}
          onActionChange={evaluation.selectAction}
          onEvaluate={() => void evaluation.runEvaluation()}
          onSubjectChange={evaluation.selectSubject}
          presentation={presentation}
          requestError={evaluation.requestError}
          result={evaluation.result}
          selectedSubject={evaluation.selectedSubject}
          subjectId={evaluation.subjectId}
        />
      </div>

      <TechnicalDetails
        hasEvaluation={presentation.hasEvaluation}
        result={evaluation.result}
      />
    </main>
  )
}
