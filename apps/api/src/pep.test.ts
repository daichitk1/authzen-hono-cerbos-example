import type {
  AccessEvaluationRequest,
  AccessEvaluationResponse,
} from '@authzen-demo/contracts'
import { describe, expect, it, vi } from 'vitest'

import {
  createApp,
  type AuthorizationClient,
  type SimulateOperation,
} from './index.js'

const createAuthorizationClient = (
  response: AccessEvaluationResponse,
): {
  client: AuthorizationClient
  evaluate: ReturnType<typeof vi.fn<AuthorizationClient['evaluate']>>
} => {
  const evaluate = vi.fn<AuthorizationClient['evaluate']>()
  evaluate.mockResolvedValue(response)

  return {
    client: { evaluate },
    evaluate,
  }
}

const createSimulation = () => {
  const simulateOperation = vi.fn<SimulateOperation>((input) => ({
    ...input,
    status: 'simulated',
  }))

  return simulateOperation
}

const sendEvaluation = (
  app: ReturnType<typeof createApp>,
  {
    subject = 'yuki',
    documentId = 'document-123',
    action = 'update',
    body,
  }: {
    subject?: string
    documentId?: string
    action?: string
    body?: unknown
  } = {},
) => {
  const headers: Record<string, string> = {
    'X-Demo-Subject': subject,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  return app.request(`/api/demo/documents/${documentId}/actions/${action}`, {
    method: 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const expectedRequest = (
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

describe('Hono Policy Enforcement Point', () => {
  it('continues to the simulated handler only after an ALLOW Decision', async () => {
    const { client, evaluate } = createAuthorizationClient({ decision: true })
    const simulateOperation = createSimulation()
    const app = createApp({
      authorizationClient: client,
      requestIdFactory: () => 'request-allow',
      simulateOperation,
    })

    const response = await sendEvaluation(app)
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(evaluate).toHaveBeenCalledOnce()
    expect(evaluate).toHaveBeenCalledWith(
      expectedRequest('yuki', 'user', 'update'),
      'request-allow',
    )
    expect(simulateOperation).toHaveBeenCalledOnce()
    expect(body).toEqual(
      expect.objectContaining({
        decision: 'ALLOW',
        requestId: 'request-allow',
        authzenResponse: { decision: true },
        simulatedOperation: {
          subject: 'yuki',
          action: 'update',
          resource: 'document-123',
          status: 'simulated',
        },
      }),
    )
  })

  it('returns 403 and never invokes the handler after a Policy Deny', async () => {
    const { client } = createAuthorizationClient({ decision: false })
    const simulateOperation = createSimulation()
    const app = createApp({
      authorizationClient: client,
      requestIdFactory: () => 'request-deny',
      simulateOperation,
    })

    const response = await sendEvaluation(app, { subject: 'ren' })
    const body: unknown = await response.json()

    expect(response.status).toBe(403)
    expect(simulateOperation).not.toHaveBeenCalled()
    expect(body).toEqual(
      expect.objectContaining({
        decision: 'DENY',
        requestId: 'request-deny',
        authzenRequest: expectedRequest('ren', 'user', 'update'),
        authzenResponse: { decision: false },
      }),
    )
  })

  it('fails closed with 503 when the PDP cannot evaluate the request', async () => {
    const evaluate = vi.fn<AuthorizationClient['evaluate']>()
    evaluate.mockRejectedValue(new Error('PDP offline'))
    const simulateOperation = createSimulation()
    const app = createApp({
      authorizationClient: { evaluate },
      requestIdFactory: () => 'request-error',
      simulateOperation,
    })

    const response = await sendEvaluation(app)
    const body: unknown = await response.json()

    expect(response.status).toBe(503)
    expect(simulateOperation).not.toHaveBeenCalled()
    expect(body).toEqual(
      expect.objectContaining({
        decision: 'NOT_EVALUATED',
        reason: 'PDP_UNAVAILABLE',
        requestId: 'request-error',
        authzenRequest: expectedRequest('yuki', 'user', 'update'),
      }),
    )
    expect(body).not.toEqual(
      expect.objectContaining({ authzenResponse: expect.anything() }),
    )
  })

  it('rejects a missing or unknown Demo Subject before PDP evaluation', async () => {
    const { client, evaluate } = createAuthorizationClient({ decision: true })
    const app = createApp({ authorizationClient: client })

    const missingSubjectResponse = await app.request(
      '/api/demo/documents/document-123/actions/read',
      { method: 'POST' },
    )
    const unknownSubjectResponse = await sendEvaluation(app, {
      subject: 'unknown',
      action: 'read',
    })

    expect(missingSubjectResponse.status).toBe(401)
    expect(unknownSubjectResponse.status).toBe(401)
    expect(evaluate).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown Document before PDP evaluation', async () => {
    const { client, evaluate } = createAuthorizationClient({ decision: true })
    const app = createApp({ authorizationClient: client })

    const response = await sendEvaluation(app, {
      documentId: 'unknown-document',
      action: 'read',
    })

    expect(response.status).toBe(404)
    expect(evaluate).not.toHaveBeenCalled()
  })

  it('rejects actions outside the server-side allowlist', async () => {
    const { client, evaluate } = createAuthorizationClient({ decision: true })
    const app = createApp({ authorizationClient: client })

    const response = await sendEvaluation(app, {
      action: 'become-admin',
    })

    expect(response.status).toBe(400)
    expect(evaluate).not.toHaveBeenCalled()
  })

  it('ignores client-supplied roles and ownerId when building the request', async () => {
    const { client, evaluate } = createAuthorizationClient({ decision: false })
    const app = createApp({
      authorizationClient: client,
      requestIdFactory: () => 'request-tampered',
    })

    const response = await sendEvaluation(app, {
      subject: 'ren',
      body: {
        roles: ['admin'],
        ownerId: 'ren',
      },
    })

    expect(response.status).toBe(403)
    expect(evaluate).toHaveBeenCalledWith(
      expectedRequest('ren', 'user', 'update'),
      'request-tampered',
    )
  })
})
