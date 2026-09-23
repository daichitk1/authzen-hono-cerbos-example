import {
  demoSubjects,
  documentActions,
  type DemoSubject,
  type DemoSubjectId,
  type DocumentAction,
} from '@authzen-demo/domain'

import type { ResultState, EvaluationPresentation } from './presentation.js'
import {
  actionControlLabels,
  roleLabels,
  subjectRelations,
} from './presentation.js'

export type EvaluationPanelProps = {
  action: DocumentAction
  isLoading: boolean
  onActionChange: (action: DocumentAction) => void
  onEvaluate: () => void
  onSubjectChange: (subjectId: DemoSubjectId) => void
  presentation: EvaluationPresentation
  requestError: string | null
  result: ResultState
  selectedSubject: DemoSubject
  subjectId: DemoSubjectId
}

export const EvaluationPanel = ({
  action,
  isLoading,
  onActionChange,
  onEvaluate,
  onSubjectChange,
  presentation,
  requestError,
  result,
  selectedSubject,
  subjectId,
}: EvaluationPanelProps) => {
  const selectedRole = selectedSubject.roles[0]

  return (
    <section
      aria-labelledby="input-heading"
      className={`evaluation-panel ${presentation.hasEvaluation ? 'has-result' : 'is-ready'}`}
    >
      <header className="section-heading">
        <h2 id="input-heading">条件を選んで判定</h2>
        <p>操作する人と、文書に対して行う操作を選んでください。</p>
      </header>

      <label className="field">
        <span>利用者</span>
        <select
          aria-label="操作する利用者"
          value={subjectId}
          onChange={(event) => {
            onSubjectChange(event.target.value as DemoSubjectId)
          }}
        >
          {demoSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.displayName}（{subjectRelations[subject.id]}）
            </option>
          ))}
        </select>
      </label>

      <div className="trusted-attribute">
        <span>システムが確認したユーザー種別</span>
        <output aria-label="確認済みのロール">
          {roleLabels[selectedRole]}
        </output>
      </div>

      <div className="resource-summary" aria-label="操作対象の文書">
        <dl>
          <div>
            <dt>対象文書</dt>
            <dd>AuthZEN デモ文書</dd>
          </div>
          <div>
            <dt>所有者</dt>
            <dd data-owner>Yuki</dd>
          </div>
        </dl>
      </div>

      <fieldset className="action-fieldset">
        <legend>操作</legend>
        <div className="action-options">
          {documentActions.map((documentAction) => (
            <label key={documentAction} className="action-option">
              <input
                type="radio"
                name="action"
                value={documentAction}
                aria-label={actionControlLabels[documentAction]}
                checked={action === documentAction}
                onChange={() => {
                  onActionChange(documentAction)
                }}
              />
              <span>{actionControlLabels[documentAction]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="selection-summary">
        <span>選択中の条件</span>
        <p>
          <strong>{selectedSubject.displayName}</strong>が、
          {subjectId === 'yuki' ? '自分の文書' : 'Yukiさんが所有する文書'}を
          <strong>{actionControlLabels[action]}</strong>。
        </p>
      </div>

      <button
        type="button"
        className={`primary-button ${presentation.hasEvaluation ? 'is-secondary' : ''}`}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label="この条件で判定する"
        onClick={onEvaluate}
      >
        {isLoading ? '判定しています…' : 'この条件で判定する'}
      </button>

      {presentation.hasEvaluation ? (
        <section
          className="result-section"
          aria-labelledby="result-heading"
          aria-live="polite"
        >
          <h2 id="result-heading">判定結果</h2>
          <div className={`decision-state ${presentation.decision.className}`}>
            <span className="status-mark" aria-hidden="true">
              {presentation.statusMark}
            </span>
            <div>
              <strong data-testid="decision">
                {presentation.decision.label}
              </strong>
              <p>{presentation.decision.description}</p>
            </div>
          </div>

          <div className="result-details">
            <div className="enforcement-result">
              <span>アプリの動作</span>
              <div>
                <strong>
                  {presentation.isAllow
                    ? '操作を続行します'
                    : '操作を中止します'}
                </strong>
                {requestError !== null ? <small>{requestError}</small> : null}
                {presentation.isNotEvaluated ? (
                  <small>判定サービスに接続できませんでした</small>
                ) : null}
                {result?.body.decision === 'DENY' ? (
                  <small>設定されたルールにより拒否されました</small>
                ) : null}
              </div>
            </div>

            <div className="reason-block" role="region" aria-label="判定理由">
              <span>判断材料</span>
              <p>{presentation.explanation}</p>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}
