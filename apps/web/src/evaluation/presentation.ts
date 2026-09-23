import type { DemoSubjectId, DocumentAction } from '@authzen-demo/domain'

import type { EvaluationResult } from '../api/evaluate-access.js'

export type ResultState = EvaluationResult | null

export type MatchingRule =
  | 'read_document'
  | 'owner_can_modify_document'
  | 'admin_can_modify_document'
  | null

export type DecisionPresentation = {
  label: string
  description: string
  className: string
}

export type EvaluationPresentation = {
  decision: DecisionPresentation
  explanation: string
  hasEvaluation: boolean
  hasPolicyDecision: boolean
  isAllow: boolean
  isNotEvaluated: boolean
  matchingRule: MatchingRule
  statusMark: '✓' | '×' | '!'
}

export const actionLabels: Record<DocumentAction, string> = {
  read: '閲覧',
  update: '編集',
  delete: '削除',
}

export const actionControlLabels: Record<DocumentAction, string> = {
  read: '閲覧する',
  update: '編集する',
  delete: '削除する',
}

export const subjectRelations: Record<DemoSubjectId, string> = {
  yuki: 'この文書の所有者',
  ren: 'この文書の所有者ではない',
  admin: '管理者',
}

export const roleLabels: Record<'user' | 'admin', string> = {
  user: '一般ユーザー',
  admin: '管理者',
}

export const getDecisionPresentation = (
  isLoading: boolean,
  requestError: string | null,
  result: ResultState,
): DecisionPresentation => {
  if (isLoading) {
    return {
      label: '判定中…',
      description: 'Cerbosのポリシーに問い合わせています。',
      className: 'decision-evaluating',
    }
  }

  if (requestError !== null || result?.body.decision === 'NOT_EVALUATED') {
    return {
      label: '判定できませんでした',
      description: '安全のため、操作を中止しました。',
      className: 'decision-not-evaluated',
    }
  }

  if (result === null) {
    return {
      label: 'まだ判定していません',
      description: '条件を選び、アクセス権を確認してください。',
      className: 'decision-not-run',
    }
  }

  if (result.body.decision === 'DENY') {
    return {
      label: '拒否されました',
      description: '選択した条件はポリシーを満たしていません。',
      className: 'decision-deny',
    }
  }

  return {
    label: '許可されました',
    description: '選択した条件はポリシーを満たしています。',
    className: 'decision-allow',
  }
}

export const getDemoExplanation = (
  result: ResultState,
  subjectId: DemoSubjectId,
  action: DocumentAction,
): string => {
  const actionLabel = actionLabels[action]

  if (result === null) {
    return '実行後、ここにポリシーと照合した理由が表示されます。'
  }

  if (result.body.decision === 'NOT_EVALUATED') {
    return '判定サービス（PDP）に接続できなかったため、許可とはみなさず処理を止めました。ポリシーによる拒否とは異なる状態です。'
  }

  if (result.body.decision === 'DENY') {
    if (subjectId === 'ren' && action !== 'read') {
      return `Renさんは文書の所有者ではないため「${actionLabel}」は許可されません。一般ユーザーが行えるのは閲覧と、自分が所有する文書の編集・削除です。`
    }

    return 'Cerbosがアクセスを拒否したため、アプリは業務処理へ進まずに停止しました。'
  }

  if (subjectId === 'admin') {
    return `管理者には、所有者に関係なく文書を「${actionLabel}」する権限があります。`
  }

  if (subjectId === 'yuki' && action !== 'read') {
    return `Yukiさんはこの文書の所有者なので「${actionLabel}」が許可されます。`
  }

  return '一般ユーザーには文書を閲覧する権限があります。'
}

export const getMatchingRule = (
  subjectId: DemoSubjectId,
  action: DocumentAction,
): MatchingRule => {
  if (action === 'read') {
    return 'read_document'
  }

  if (subjectId === 'admin') {
    return 'admin_can_modify_document'
  }

  return subjectId === 'yuki' ? 'owner_can_modify_document' : null
}

export const getEvaluationPresentation = ({
  action,
  isLoading,
  requestError,
  result,
  subjectId,
}: {
  action: DocumentAction
  isLoading: boolean
  requestError: string | null
  result: ResultState
  subjectId: DemoSubjectId
}): EvaluationPresentation => {
  const isAllow = result?.body.decision === 'ALLOW'

  return {
    decision: getDecisionPresentation(isLoading, requestError, result),
    explanation:
      requestError === null
        ? getDemoExplanation(result, subjectId, action)
        : '通信を完了できなかったため、安全のため操作を中止しました。接続を確認して再実行してください。',
    hasEvaluation: result !== null || requestError !== null,
    hasPolicyDecision:
      result?.body.decision === 'ALLOW' || result?.body.decision === 'DENY',
    isAllow,
    isNotEvaluated: result?.body.decision === 'NOT_EVALUATED',
    matchingRule: getMatchingRule(subjectId, action),
    statusMark: isAllow ? '✓' : result?.body.decision === 'DENY' ? '×' : '!',
  }
}
