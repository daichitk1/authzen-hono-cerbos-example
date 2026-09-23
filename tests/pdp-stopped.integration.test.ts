import { describe, expect, it, vi } from 'vitest'

import { createApp, type SimulateOperation } from '../apps/api/src/index.js'

describe('Fail Closed when Cerbos is stopped', () => {
  it('returns 503 without running the business handler', async () => {
    process.env.PDP_BASE_URL = 'http://127.0.0.1:3592'
    process.env.PDP_TIMEOUT_MS = '100'

    const simulateOperation = vi.fn<SimulateOperation>()
    const app = createApp({
      requestIdFactory: () => 'cerbos-stopped-request',
      simulateOperation,
    })

    const response = await app.request(
      '/api/demo/documents/document-123/actions/update',
      {
        method: 'POST',
        headers: {
          'X-Demo-Subject': 'yuki',
        },
      },
    )
    const body: unknown = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual(
      expect.objectContaining({
        decision: 'NOT_EVALUATED',
        reason: 'PDP_UNAVAILABLE',
        requestId: 'cerbos-stopped-request',
      }),
    )
    expect(body).not.toHaveProperty('simulatedOperation')
    expect(simulateOperation).not.toHaveBeenCalled()
  })
})
