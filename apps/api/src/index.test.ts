import { describe, expect, it } from 'vitest'

import { app } from './index.js'

describe('API foundation', () => {
  it('returns the health response used by local readiness checks', async () => {
    const response = await app.request('/health')
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      status: 'ok',
      service: 'authzen-demo-api',
    })
  })
})
