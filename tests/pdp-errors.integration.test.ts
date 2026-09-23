import { createServer, type ServerResponse } from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp, type SimulateOperation } from '../apps/api/src/index.js'

type PdpHandler = (response: ServerResponse) => void

const startPdp = async (handler: PdpHandler) => {
  const server = createServer((_request, response) => {
    handler(response)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Could not resolve fake PDP address')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  }
}

const originalPdpBaseUrl = process.env.PDP_BASE_URL
const originalPdpTimeoutMs = process.env.PDP_TIMEOUT_MS

afterEach(() => {
  if (originalPdpBaseUrl === undefined) {
    delete process.env.PDP_BASE_URL
  } else {
    process.env.PDP_BASE_URL = originalPdpBaseUrl
  }

  if (originalPdpTimeoutMs === undefined) {
    delete process.env.PDP_TIMEOUT_MS
  } else {
    process.env.PDP_TIMEOUT_MS = originalPdpTimeoutMs
  }
})

const exerciseFailure = async (
  handler: PdpHandler,
  timeoutMs = 200,
): Promise<void> => {
  const pdp = await startPdp(handler)
  process.env.PDP_BASE_URL = pdp.baseUrl
  process.env.PDP_TIMEOUT_MS = String(timeoutMs)

  const simulateOperation = vi.fn<SimulateOperation>()
  const app = createApp({
    requestIdFactory: () => 'pdp-error-request',
    simulateOperation,
  })

  try {
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
        requestId: 'pdp-error-request',
      }),
    )
    expect(body).not.toHaveProperty('simulatedOperation')
    expect(simulateOperation).not.toHaveBeenCalled()
  } finally {
    await pdp.close()
  }
}

describe('PDP failure boundaries', () => {
  it('fails closed for HTTP 500', async () => {
    await exerciseFailure((response) => {
      response.statusCode = 500
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ error: 'boom' }))
    })
  })

  it('fails closed for invalid JSON', async () => {
    await exerciseFailure((response) => {
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json')
      response.end('{invalid-json')
    })
  })

  it('fails closed when decision is missing', async () => {
    await exerciseFailure((response) => {
      response.statusCode = 200
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ context: {} }))
    })
  })

  it('fails closed on timeout', async () => {
    await exerciseFailure((response) => {
      setTimeout(() => {
        if (!response.writableEnded) {
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ decision: true }))
        }
      }, 100)
    }, 20)
  })
})
