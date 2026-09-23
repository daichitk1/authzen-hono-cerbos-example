import { Hono } from 'hono'

import { createAuthZenClient } from './authzen/client.js'
import { authorizeDocument } from './middleware/authorize-document.js'
import { demoAuthenticate } from './middleware/demo-authenticate.js'
import { loadDocument } from './middleware/load-document.js'
import type {
  AppEnv,
  AuthorizationClient,
  CreateAppOptions,
  SimulateOperation,
} from './pep/types.js'

export type { AuthorizationClient, SimulateOperation } from './pep/types.js'

const DEFAULT_PDP_TIMEOUT_MS = 1500

const resolvePdpTimeoutMs = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '', 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PDP_TIMEOUT_MS
}

// Production codeから見たPDPとの接続口。通常は実Cerbosへ接続し、TestではFakeへ差し替えられる。
const createDefaultAuthorizationClient = (): AuthorizationClient => {
  return createAuthZenClient({
    baseUrl: process.env.PDP_BASE_URL ?? 'http://127.0.0.1:3592',
    timeoutMs: resolvePdpTimeoutMs(process.env.PDP_TIMEOUT_MS),
  })
}

// PoCでは認可フローの確認が目的なので、実際のDocument更新・削除は行わずSimulationにする。
const defaultSimulateOperation: SimulateOperation = (input) => ({
  ...input,
  status: 'simulated',
})

export const createApp = (options: CreateAppOptions = {}) => {
  const app = new Hono<AppEnv>()
  const authorizationClient =
    options.authorizationClient ?? createDefaultAuthorizationClient()
  const requestIdFactory =
    options.requestIdFactory ?? (() => crypto.randomUUID())
  const simulateOperation =
    options.simulateOperation ?? defaultSimulateOperation

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'authzen-demo-api',
    }),
  )

  // PEPの流れはMiddlewareの並び順そのもの。
  // 1. Subject確定 → 2. Resource取得 → 3. PDPへ認可問い合わせ → 4. ALLOW時だけHandler。
  app.post(
    '/api/demo/documents/:id/actions/:action',
    demoAuthenticate,
    loadDocument,
    authorizeDocument(authorizationClient, requestIdFactory),
    (c) => {
      // このHandlerへ到達できるのはauthorizeDocumentがdecision: trueを受け取った場合だけ。
      const user = c.get('currentUser')
      const document = c.get('document')
      const action = c.get('documentAction')
      const trace = c.get('authorizationTrace')
      const simulatedOperation = simulateOperation({
        subject: user.id,
        action,
        resource: document.id,
      })

      return c.json({
        decision: 'ALLOW',
        requestId: trace.requestId,
        authzenRequest: trace.request,
        authzenResponse: trace.response,
        simulatedOperation,
      })
    },
  )

  return app
}

export const app = createApp()
