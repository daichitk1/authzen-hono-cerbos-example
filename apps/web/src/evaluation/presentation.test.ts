import type {
  AccessEvaluationRequest,
  AuthorizationEvaluationResponse,
} from '@authzen-demo/contracts'
import { describe, expect, it } from 'vitest'

import type { EvaluationResult } from '../api/evaluate-access.js'
import {
  getDecisionPresentation,
  getDemoExplanation,
  getEvaluationPresentation,
  getMatchingRule,
} from './presentation.js'

const authzenRequest: AccessEvaluationRequest = {
  subject: {
    type: 'user',
    id: 'yuki',
    properties: {
      'cerbos.roles': ['user'],
    },
  },
  action: {
    name: 'update',
  },
  resource: {
    type: 'document',
    id: 'document-123',
    properties: {
      ownerId: 'yuki',
    },
  },
}

const createResult = (
  decision: AuthorizationEvaluationResponse['decision'],
): EvaluationResult => {
  if (decision === 'ALLOW') {
    return {
      httpStatus: 200,
      body: {
        decision,
        requestId: 'request-allow',
        authzenRequest,
        authzenResponse: { decision: true },
        simulatedOperation: {
          subject: 'yuki',
          action: 'update',
          resource: 'document-123',
          status: 'simulated',
        },
      },
    }
  }

  if (decision === 'DENY') {
    return {
      httpStatus: 403,
      body: {
        decision,
        requestId: 'request-deny',
        authzenRequest,
        authzenResponse: { decision: false },
      },
    }
  }

  return {
    httpStatus: 503,
    body: {
      decision,
      reason: 'PDP_UNAVAILABLE',
      requestId: 'request-not-evaluated',
      authzenRequest,
    },
  }
}

describe('evaluation presentation', () => {
  it.each([
    {
      name: 'loading',
      isLoading: true,
      requestError: null,
      result: null,
      label: '判定中…',
      className: 'decision-evaluating',
    },
    {
      name: 'request error',
      isLoading: false,
      requestError: 'サーバーに接続できませんでした',
      result: null,
      label: '判定できませんでした',
      className: 'decision-not-evaluated',
    },
    {
      name: 'ALLOW',
      isLoading: false,
      requestError: null,
      result: createResult('ALLOW'),
      label: '許可されました',
      className: 'decision-allow',
    },
    {
      name: 'DENY',
      isLoading: false,
      requestError: null,
      result: createResult('DENY'),
      label: '拒否されました',
      className: 'decision-deny',
    },
    {
      name: 'NOT_EVALUATED',
      isLoading: false,
      requestError: null,
      result: createResult('NOT_EVALUATED'),
      label: '判定できませんでした',
      className: 'decision-not-evaluated',
    },
  ])('maps $name to its decision presentation', (scenario) => {
    expect(
      getDecisionPresentation(
        scenario.isLoading,
        scenario.requestError,
        scenario.result,
      ),
    ).toMatchObject({
      label: scenario.label,
      className: scenario.className,
    })
  })

  it.each([
    ['yuki', 'read', 'read_document'],
    ['ren', 'read', 'read_document'],
    ['yuki', 'update', 'owner_can_modify_document'],
    ['admin', 'delete', 'admin_can_modify_document'],
    ['ren', 'update', null],
  ] as const)(
    'maps %s + %s to the matching policy rule',
    (subject, action, rule) => {
      expect(getMatchingRule(subject, action)).toBe(rule)
    },
  )

  it('explains owner, administrator, reader and default-deny outcomes', () => {
    expect(
      getDemoExplanation(createResult('ALLOW'), 'yuki', 'update'),
    ).toContain('文書の所有者')
    expect(
      getDemoExplanation(createResult('ALLOW'), 'admin', 'delete'),
    ).toContain('管理者')
    expect(getDemoExplanation(createResult('ALLOW'), 'ren', 'read')).toContain(
      '文書を閲覧する権限',
    )
    expect(getDemoExplanation(createResult('DENY'), 'ren', 'update')).toContain(
      'Renさんは文書の所有者ではない',
    )
  })

  it('keeps policy unavailability distinct from a browser request error', () => {
    expect(
      getDemoExplanation(createResult('NOT_EVALUATED'), 'yuki', 'update'),
    ).toContain('ポリシーによる拒否とは異なる')

    const presentation = getEvaluationPresentation({
      action: 'update',
      isLoading: false,
      requestError: 'サーバーに接続できませんでした',
      result: null,
      subjectId: 'yuki',
    })

    expect(presentation.hasEvaluation).toBe(true)
    expect(presentation.statusMark).toBe('!')
    expect(presentation.explanation).toContain('通信を完了できなかった')
  })
})
