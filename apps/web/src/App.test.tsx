import type {
  AccessEvaluationRequest,
  AuthorizationEvaluationResponse,
} from '@authzen-demo/contracts'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App.js'
import type { EvaluateAccess, EvaluationResult } from './api/evaluate-access.js'

const createRequest = (
  subjectId: 'yuki' | 'ren' | 'admin',
  role: 'user' | 'admin',
  action: 'read' | 'update' | 'delete',
): AccessEvaluationRequest => ({
  subject: {
    type: 'user',
    id: subjectId,
    properties: {
      'cerbos.roles': [role],
    },
  },
  action: {
    name: action,
  },
  resource: {
    type: 'document',
    id: 'document-123',
    properties: {
      ownerId: 'yuki',
    },
  },
})

const createResult = (
  decision: AuthorizationEvaluationResponse['decision'],
  {
    subjectId = 'yuki',
    role = 'user',
    action = 'update',
  }: {
    subjectId?: 'yuki' | 'ren' | 'admin'
    role?: 'user' | 'admin'
    action?: 'read' | 'update' | 'delete'
  } = {},
): EvaluationResult => {
  const authzenRequest = createRequest(subjectId, role, action)

  if (decision === 'ALLOW') {
    return {
      httpStatus: 200,
      body: {
        decision,
        requestId: `request-${subjectId}-${action}`,
        authzenRequest,
        authzenResponse: {
          decision: true,
        },
        simulatedOperation: {
          subject: subjectId,
          action,
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
        requestId: `request-${subjectId}-${action}`,
        authzenRequest,
        authzenResponse: {
          decision: false,
        },
      },
    }
  }

  return {
    httpStatus: 503,
    body: {
      decision,
      reason: 'PDP_UNAVAILABLE',
      requestId: `request-${subjectId}-${action}`,
      authzenRequest,
    },
  }
}

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

const renderApp = (evaluate: EvaluateAccess) => {
  render(<App evaluate={evaluate} />)
}

describe('AuthZEN 認可デモ', () => {
  it('shows fixed inputs with a read-only Role before evaluation', () => {
    const evaluate = vi.fn<EvaluateAccess>()
    renderApp(evaluate)

    expect(
      screen.getByRole('heading', { name: '文書のアクセス権を確認' }),
    ).toBeInTheDocument()
    const policyRules = screen.getByRole('list', { name: '許可される条件' })
    expect(policyRules).toBeInTheDocument()
    expect(screen.getByTestId('policy-rule-read')).toHaveTextContent(
      '一般ユーザーと管理者',
    )
    expect(screen.getByTestId('policy-rule-owner')).toHaveTextContent(
      '自分が所有する文書だけ',
    )
    expect(screen.getByTestId('policy-rule-default-deny')).toHaveTextContent(
      '上記に当てはまらない',
    )
    expect(screen.queryByText('この判定に対応')).not.toBeInTheDocument()
    expect(screen.getByLabelText('操作する利用者')).toHaveValue('yuki')
    expect(screen.getByLabelText('確認済みのロール')).toHaveTextContent(
      '一般ユーザー',
    )
    expect(screen.queryByText('document-123')).not.toBeInTheDocument()
    expect(
      screen.getByText('Yuki', { selector: '[data-owner]' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '編集する' })).toBeChecked()
    const evaluateButton = screen.getByRole('button', {
      name: 'この条件で判定する',
    })
    expect(evaluateButton).toBeEnabled()
    expect(evaluateButton).not.toHaveClass('is-secondary')
    expect(
      screen
        .getByRole('heading', { name: '条件を選んで判定' })
        .closest('section'),
    ).toHaveClass('is-ready')
    expect(screen.queryByTestId('decision')).not.toBeInTheDocument()
  })

  it('shows ALLOW, HTTP status, Request ID and JSON after evaluation', async () => {
    const evaluate = vi.fn<EvaluateAccess>()
    evaluate.mockResolvedValue(createResult('ALLOW'))
    renderApp(evaluate)

    fireEvent.click(screen.getByRole('button', { name: 'この条件で判定する' }))

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent('許可されました')
    })

    expect(evaluate).toHaveBeenCalledWith({
      subjectId: 'yuki',
      documentId: 'document-123',
      action: 'update',
    })
    expect(screen.getByText('HTTP 200')).toBeInTheDocument()
    expect(screen.getByText('request-yuki-update')).toBeInTheDocument()
    expect(screen.getByText('操作を続行します')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'この条件で判定する' }),
    ).toHaveClass('is-secondary')
    expect(
      screen
        .getByRole('heading', { name: '条件を選んで判定' })
        .closest('section'),
    ).toHaveClass('has-result')
    expect(screen.getByTestId('policy-rule-owner')).toHaveTextContent(
      'この判定に対応',
    )
    expect(
      screen.getByRole('region', {
        name: 'AuthZEN リクエスト',
        hidden: true,
      }),
    ).toHaveTextContent('"ownerId": "yuki"')
    expect(
      screen.getByRole('region', { name: 'PDP の応答', hidden: true }),
    ).toHaveTextContent('"decision": true')
  })

  it('restores the pre-evaluation hierarchy when an input changes', async () => {
    const evaluate = vi.fn<EvaluateAccess>()
    evaluate.mockResolvedValue(createResult('ALLOW'))
    renderApp(evaluate)
    const button = screen.getByRole('button', {
      name: 'この条件で判定する',
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent('許可されました')
    })
    expect(button).toHaveClass('is-secondary')
    expect(screen.getByText('この判定に対応')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('操作する利用者'), {
      target: { value: 'ren' },
    })

    expect(screen.queryByTestId('decision')).not.toBeInTheDocument()
    expect(screen.queryByText('この判定に対応')).not.toBeInTheDocument()
    expect(button).not.toHaveClass('is-secondary')
    expect(
      screen
        .getByRole('heading', { name: '条件を選んで判定' })
        .closest('section'),
    ).toHaveClass('is-ready')
  })

  it('shows a Policy DENY separately from the Demo explanation', async () => {
    const evaluate = vi.fn<EvaluateAccess>()
    evaluate.mockResolvedValue(
      createResult('DENY', {
        subjectId: 'ren',
      }),
    )
    renderApp(evaluate)

    fireEvent.change(screen.getByLabelText('操作する利用者'), {
      target: { value: 'ren' },
    })
    expect(screen.queryByText('この判定に対応')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'この条件で判定する' }))

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent('拒否されました')
    })

    expect(screen.getByText('HTTP 403')).toBeInTheDocument()
    expect(screen.getByTestId('policy-rule-default-deny')).toHaveTextContent(
      'この判定に対応',
    )
    expect(
      screen.getByRole('region', { name: 'PDP の応答', hidden: true }),
    ).toHaveTextContent('"decision": false')
    expect(screen.getByRole('region', { name: '判定理由' })).toHaveTextContent(
      'Renさんは文書の所有者ではない',
    )
    expect(
      screen.getByRole('region', { name: 'PDP の応答', hidden: true }),
    ).not.toHaveTextContent('Renさんは文書の所有者ではない')
  })

  it('allows selecting Admin and delete without making Role editable', async () => {
    const evaluate = vi.fn<EvaluateAccess>()
    evaluate.mockResolvedValue(
      createResult('ALLOW', {
        subjectId: 'admin',
        role: 'admin',
        action: 'delete',
      }),
    )
    renderApp(evaluate)

    fireEvent.change(screen.getByLabelText('操作する利用者'), {
      target: { value: 'admin' },
    })
    fireEvent.click(screen.getByRole('radio', { name: '削除する' }))

    expect(screen.getByLabelText('確認済みのロール')).toHaveTextContent(
      '管理者',
    )
    expect(
      screen.queryByRole('textbox', { name: '確認済みのロール' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'この条件で判定する' }))

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent('許可されました')
    })

    expect(evaluate).toHaveBeenCalledWith({
      subjectId: 'admin',
      documentId: 'document-123',
      action: 'delete',
    })
  })

  it('shows NOT EVALUATED when the PDP is unavailable', async () => {
    const evaluate = vi.fn<EvaluateAccess>()
    evaluate.mockResolvedValue(createResult('NOT_EVALUATED'))
    renderApp(evaluate)

    fireEvent.click(screen.getByRole('button', { name: 'この条件で判定する' }))

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent(
        '判定できませんでした',
      )
    })

    expect(screen.getByText('HTTP 503')).toBeInTheDocument()
    expect(screen.getByText('操作を中止します')).toBeInTheDocument()
    expect(
      screen.getByText('判定サービスに接続できませんでした'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'PDP の応答', hidden: true }),
    ).toHaveTextContent('PDPから応答データは返されませんでした')
  })

  it('prevents duplicate evaluation while a request is in progress', async () => {
    const deferred = createDeferred<EvaluationResult>()
    const evaluate = vi.fn<EvaluateAccess>(() => deferred.promise)
    renderApp(evaluate)
    const button = screen.getByRole('button', {
      name: 'この条件で判定する',
    })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(evaluate).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('判定しています')
    expect(screen.queryByTestId('decision')).not.toBeInTheDocument()

    await act(async () => {
      deferred.resolve(createResult('ALLOW'))
      await deferred.promise
    })

    expect(button).toBeEnabled()
  })

  it('shows a retryable Network Error and can recover', async () => {
    const evaluate = vi.fn<EvaluateAccess>()
    evaluate
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(createResult('ALLOW'))
    renderApp(evaluate)

    fireEvent.click(screen.getByRole('button', { name: 'この条件で判定する' }))

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent(
        '判定できませんでした',
      )
    })

    expect(
      screen.getByText('サーバーに接続できませんでした'),
    ).toBeInTheDocument()
    expect(screen.getByText('操作を中止します')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'この条件で判定する' }))

    await waitFor(() => {
      expect(screen.getByTestId('decision')).toHaveTextContent('許可されました')
    })

    expect(evaluate).toHaveBeenCalledTimes(2)
  })
})
