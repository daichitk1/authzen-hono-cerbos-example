import type { AuthorizationEvaluationResponse } from '@authzen-demo/contracts'
import { describe, expect, it, vi } from 'vitest'

import { createEvaluateAccess } from './evaluate-access.js'

const authzenRequest = {
  subject: {
    type: 'user',
    id: 'ren',
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

const responseBody = (
  decision: AuthorizationEvaluationResponse['decision'],
): AuthorizationEvaluationResponse => {
  if (decision === 'ALLOW') {
    return {
      decision,
      requestId: 'request-allow',
      authzenRequest,
      authzenResponse: {
        decision: true,
      },
      simulatedOperation: {
        subject: 'yuki',
        action: 'update',
        resource: 'document-123',
        status: 'simulated',
      },
    }
  }

  if (decision === 'DENY') {
    return {
      decision,
      requestId: 'request-deny',
      authzenRequest,
      authzenResponse: {
        decision: false,
      },
    }
  }

  return {
    decision,
    reason: 'PDP_UNAVAILABLE',
    requestId: 'request-error',
    authzenRequest,
  }
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

describe('createEvaluateAccess', () => {
  it.each([
    ['ALLOW', 200],
    ['DENY', 403],
    ['NOT_EVALUATED', 503],
  ] as const)('accepts %s with HTTP %i', async (decision, httpStatus) => {
    const body = responseBody(decision)
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue(jsonResponse(body, httpStatus))
    const evaluate = createEvaluateAccess({
      baseUrl: 'http://api.example.test/',
      fetch: fetchMock,
    })

    await expect(
      evaluate({
        subjectId: 'ren',
        documentId: 'document-123',
        action: 'update',
      }),
    ).resolves.toEqual({
      httpStatus,
      body,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.example.test/api/demo/documents/document-123/actions/update',
      {
        method: 'POST',
        headers: {
          'X-Demo-Subject': 'ren',
        },
      },
    )
  })

  it('rejects an invalid JSON response', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue(new Response('{', { status: 200 }))
    const evaluate = createEvaluateAccess({ fetch: fetchMock })

    await expect(
      evaluate({
        subjectId: 'yuki',
        documentId: 'document-123',
        action: 'read',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_JSON',
    })
  })

  it('rejects a response whose HTTP status conflicts with its Decision', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue(jsonResponse(responseBody('DENY'), 200))
    const evaluate = createEvaluateAccess({ fetch: fetchMock })

    await expect(
      evaluate({
        subjectId: 'ren',
        documentId: 'document-123',
        action: 'update',
      }),
    ).rejects.toMatchObject({
      code: 'UNEXPECTED_STATUS',
      httpStatus: 200,
    })
  })

  it('rejects a payload outside the Authorization response contract', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue(jsonResponse({ decision: 'ALLOW' }, 200))
    const evaluate = createEvaluateAccess({ fetch: fetchMock })

    await expect(
      evaluate({
        subjectId: 'yuki',
        documentId: 'document-123',
        action: 'read',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('classifies a fetch rejection as a Network Error', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockRejectedValue(new TypeError('connection refused'))
    const evaluate = createEvaluateAccess({ fetch: fetchMock })

    await expect(
      evaluate({
        subjectId: 'admin',
        documentId: 'document-123',
        action: 'delete',
      }),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })
})
