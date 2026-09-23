import type { AccessEvaluationRequest } from '@authzen-demo/contracts'
import { describe, expect, it, vi } from 'vitest'

import { createAuthZenClient } from './client.js'

const accessRequest: AccessEvaluationRequest = {
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

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

const createClient = (
  fetchImpl: typeof fetch,
  options: { baseUrl?: string; timeoutMs?: number } = {},
) =>
  createAuthZenClient({
    baseUrl: options.baseUrl ?? 'https://pdp.example/',
    timeoutMs: options.timeoutMs ?? 50,
    fetch: fetchImpl,
  })

describe('createAuthZenClient', () => {
  describe('configuration', () => {
    it('normalizes trailing slashes in the PDP base URL', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(jsonResponse({ decision: true }))
      const client = createClient(fetchMock, {
        baseUrl: 'https://pdp.example///',
      })

      await client.evaluate(accessRequest, 'request-base-url')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://pdp.example/access/v1/evaluation',
        expect.any(Object),
      )
    })

    it('rejects an empty PDP base URL', () => {
      expect(() =>
        createAuthZenClient({
          baseUrl: '   ',
          fetch: vi.fn<typeof fetch>(),
        }),
      ).toThrow('AuthZEN PDP base URL must not be empty')
    })

    it.each([0, -1, Number.NaN])(
      'rejects invalid timeout value %s',
      (timeoutMs) => {
        expect(() =>
          createAuthZenClient({
            baseUrl: 'https://pdp.example',
            timeoutMs,
            fetch: vi.fn<typeof fetch>(),
          }),
        ).toThrow('AuthZEN PDP timeout must be a positive number')
      },
    )
  })

  describe('successful evaluation', () => {
    it('returns an allow Decision and sends the request ID', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(jsonResponse({ decision: true }))
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-123'),
      ).resolves.toEqual({
        decision: true,
      })

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock).toHaveBeenCalledWith(
        'https://pdp.example/access/v1/evaluation',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'request-123',
          },
          body: JSON.stringify(accessRequest),
        }),
      )
    })

    it('returns a deny Decision without throwing', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(jsonResponse({ decision: false }))
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-deny'),
      ).resolves.toEqual({
        decision: false,
      })
    })

    it('preserves optional response context', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(
        jsonResponse({
          decision: false,
          context: {
            reason: 'insufficient_privileges',
          },
        }),
      )
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-context'),
      ).resolves.toEqual({
        decision: false,
        context: {
          reason: 'insufficient_privileges',
        },
      })
    })
  })

  describe('invalid PDP response', () => {
    it('classifies non-success HTTP responses separately from Policy Deny', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(jsonResponse({ error: 'unavailable' }, 500))
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-http-error'),
      ).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        status: 500,
      })
    })

    it('classifies invalid JSON as a client error', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(
        new Response('{', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-invalid-json'),
      ).rejects.toMatchObject({
        code: 'INVALID_JSON',
      })
    })

    it('rejects a JSON payload without a boolean Decision', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockResolvedValue(jsonResponse({}))
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-invalid-payload'),
      ).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      })
    })
  })

  describe('transport failures', () => {
    it('aborts while waiting for the PDP response', async () => {
      const fetchMock = vi.fn<typeof fetch>((_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        })
      })
      const client = createClient(fetchMock, { timeoutMs: 5 })

      await expect(
        client.evaluate(accessRequest, 'request-timeout'),
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })

    it('aborts while reading the PDP response body', async () => {
      const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
        return {
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Aborted', 'AbortError')),
                { once: true },
              )
            }),
        } as Response
      })
      const client = createClient(fetchMock, { timeoutMs: 5 })

      await expect(
        client.evaluate(accessRequest, 'request-body-timeout'),
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })

    it('classifies transport failures separately from HTTP errors', async () => {
      const fetchMock = vi.fn<typeof fetch>()
      fetchMock.mockRejectedValue(new TypeError('connection refused'))
      const client = createClient(fetchMock)

      await expect(
        client.evaluate(accessRequest, 'request-network-error'),
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      })
    })
  })
})
