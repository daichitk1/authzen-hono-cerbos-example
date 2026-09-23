import { describe, expect, it, vi } from 'vitest'

import { createApp, type SimulateOperation } from '../apps/api/src/index.js'

type MatrixCase = {
  subjectId: 'yuki' | 'ren' | 'admin'
  action: 'read' | 'update' | 'delete'
  expectedStatus: 200 | 403
  expectedDecision: 'ALLOW' | 'DENY'
}

const matrix: MatrixCase[] = [
  {
    subjectId: 'yuki',
    action: 'read',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
  {
    subjectId: 'yuki',
    action: 'update',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
  {
    subjectId: 'yuki',
    action: 'delete',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
  {
    subjectId: 'ren',
    action: 'read',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
  {
    subjectId: 'ren',
    action: 'update',
    expectedStatus: 403,
    expectedDecision: 'DENY',
  },
  {
    subjectId: 'ren',
    action: 'delete',
    expectedStatus: 403,
    expectedDecision: 'DENY',
  },
  {
    subjectId: 'admin',
    action: 'read',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
  {
    subjectId: 'admin',
    action: 'update',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
  {
    subjectId: 'admin',
    action: 'delete',
    expectedStatus: 200,
    expectedDecision: 'ALLOW',
  },
]

const createSimulation = () =>
  vi.fn<SimulateOperation>((input) => ({
    ...input,
    status: 'simulated',
  }))

describe('Hono PEP with real Cerbos', () => {
  it.each(matrix)(
    '$subjectId + $action -> $expectedDecision',
    async ({ subjectId, action, expectedStatus, expectedDecision }) => {
      const requestId = `matrix-${subjectId}-${action}`
      const simulateOperation = createSimulation()
      const app = createApp({
        requestIdFactory: () => requestId,
        simulateOperation,
      })

      const response = await app.request(
        `/api/demo/documents/document-123/actions/${action}`,
        {
          method: 'POST',
          headers: {
            'X-Demo-Subject': subjectId,
          },
        },
      )
      const body: unknown = await response.json()

      expect(response.status).toBe(expectedStatus)
      expect(body).toEqual(
        expect.objectContaining({
          decision: expectedDecision,
          requestId,
        }),
      )

      if (expectedDecision === 'ALLOW') {
        expect(simulateOperation).toHaveBeenCalledOnce()
        expect(body).toEqual(
          expect.objectContaining({
            simulatedOperation: expect.objectContaining({
              subject: subjectId,
              action,
              resource: 'document-123',
              status: 'simulated',
            }),
          }),
        )
      } else {
        expect(simulateOperation).not.toHaveBeenCalled()
        expect(body).not.toHaveProperty('simulatedOperation')
      }
    },
  )

  it('rejects a missing Demo Subject', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/demo/documents/document-123/actions/read',
      { method: 'POST' },
    )

    expect(response.status).toBe(401)
  })

  it('rejects an unknown Demo Subject', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/demo/documents/document-123/actions/read',
      {
        method: 'POST',
        headers: {
          'X-Demo-Subject': 'unknown',
        },
      },
    )

    expect(response.status).toBe(401)
  })

  it('returns 404 for an unknown Document', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/demo/documents/document-999/actions/read',
      {
        method: 'POST',
        headers: {
          'X-Demo-Subject': 'yuki',
        },
      },
    )

    expect(response.status).toBe(404)
  })

  it('returns 400 for an Action outside the allowlist', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/demo/documents/document-123/actions/publish',
      {
        method: 'POST',
        headers: {
          'X-Demo-Subject': 'yuki',
        },
      },
    )

    expect(response.status).toBe(400)
  })

  it('ignores client Role and ownerId tampering', async () => {
    const simulateOperation = createSimulation()
    const app = createApp({
      requestIdFactory: () => 'tamper-attempt',
      simulateOperation,
    })
    const response = await app.request(
      '/api/demo/documents/document-123/actions/update',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Subject': 'ren',
        },
        body: JSON.stringify({
          role: 'admin',
          roles: ['admin'],
          ownerId: 'ren',
        }),
      },
    )
    const body: unknown = await response.json()

    expect(response.status).toBe(403)
    expect(simulateOperation).not.toHaveBeenCalled()
    expect(body).toEqual(
      expect.objectContaining({
        decision: 'DENY',
        authzenRequest: expect.objectContaining({
          subject: expect.objectContaining({
            id: 'ren',
            properties: {
              'cerbos.roles': ['user'],
            },
          }),
          resource: expect.objectContaining({
            id: 'document-123',
            properties: {
              ownerId: 'yuki',
            },
          }),
        }),
      }),
    )
  })
})
