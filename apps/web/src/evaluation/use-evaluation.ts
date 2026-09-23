import { useState } from 'react'

import {
  demoDocument,
  demoSubjects,
  type DemoSubject,
  type DemoSubjectId,
  type DocumentAction,
} from '@authzen-demo/domain'

import {
  isEvaluationApiError,
  type EvaluateAccess,
} from '../api/evaluate-access.js'
import type { ResultState } from './presentation.js'

const isNetworkFailure = (error: unknown): boolean => {
  return (
    error instanceof TypeError ||
    (isEvaluationApiError(error) && error.code === 'NETWORK_ERROR')
  )
}

export type EvaluationController = {
  action: DocumentAction
  isLoading: boolean
  requestError: string | null
  result: ResultState
  runEvaluation: () => Promise<void>
  selectedSubject: DemoSubject
  selectAction: (action: DocumentAction) => void
  selectSubject: (subjectId: DemoSubjectId) => void
  subjectId: DemoSubjectId
}

export const useEvaluation = (
  evaluate: EvaluateAccess,
): EvaluationController => {
  const [subjectId, setSubjectId] = useState<DemoSubjectId>('yuki')
  const [action, setAction] = useState<DocumentAction>('update')
  const [result, setResult] = useState<ResultState>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const selectedSubject =
    demoSubjects.find((subject) => subject.id === subjectId) ?? demoSubjects[0]

  const resetEvaluation = () => {
    setResult(null)
    setRequestError(null)
  }

  const selectSubject = (nextSubjectId: DemoSubjectId) => {
    setSubjectId(nextSubjectId)
    resetEvaluation()
  }

  const selectAction = (nextAction: DocumentAction) => {
    setAction(nextAction)
    resetEvaluation()
  }

  const runEvaluation = async () => {
    if (isLoading) {
      return
    }

    setIsLoading(true)
    setResult(null)
    setRequestError(null)

    try {
      const nextResult = await evaluate({
        subjectId,
        documentId: demoDocument.id,
        action,
      })
      setResult(nextResult)
    } catch (error) {
      setResult(null)
      setRequestError(
        isNetworkFailure(error)
          ? 'サーバーに接続できませんでした'
          : '判定処理でエラーが発生しました',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return {
    action,
    isLoading,
    requestError,
    result,
    runEvaluation,
    selectedSubject,
    selectAction,
    selectSubject,
    subjectId,
  }
}
