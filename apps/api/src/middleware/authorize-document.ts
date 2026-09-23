import type {
  AccessEvaluationRequest,
  AccessEvaluationResponse,
} from '@authzen-demo/contracts'
import {
  isDocumentAction,
  type DemoDocument,
  type DemoSubject,
  type DocumentAction,
} from '@authzen-demo/domain'
import { createMiddleware } from 'hono/factory'

import type {
  AppEnv,
  AuthorizationClient,
  AuthorizationTrace,
} from '../pep/types.js'

// 前段Middlewareで解決した信頼済みSubject / Resourceと、allowlist済みActionから
// AuthZENの「誰が・何を・何に対して」を表すAccess Evaluation Requestを組み立てる。
const buildAccessEvaluationRequest = (
  user: DemoSubject,
  document: DemoDocument,
  action: DocumentAction,
): AccessEvaluationRequest => ({
  subject: {
    type: 'user',
    id: user.id,
    properties: {
      // cerbos.rolesはAuthZEN共通のRole表現ではなく、Cerbos固有のMapping用Property。
      'cerbos.roles': [...user.roles],
    },
  },
  action: {
    name: action,
  },
  resource: {
    type: document.type,
    id: document.id,
    properties: {
      // Owner判定に使う属性。Client入力ではなくloadDocumentで取得したServer-side値を使う。
      ownerId: document.ownerId,
    },
  },
})

// HonoをPEPとして機能させる中心Middleware。
// PDPへ問い合わせるだけでなく、返ってきたDecisionを後続処理へ必ず強制する。
export const authorizeDocument = (
  authorizationClient: AuthorizationClient,
  requestIdFactory: () => string,
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const rawAction = c.req.param('action')

    // PDPへ任意のActionを送らず、このアプリが定義したActionだけを認可対象にする。
    if (!rawAction || !isDocumentAction(rawAction)) {
      return c.json(
        {
          error: 'INVALID_ACTION',
        },
        400,
      )
    }

    const user = c.get('currentUser')
    const document = c.get('document')
    const requestId = requestIdFactory()
    const request = buildAccessEvaluationRequest(user, document, rawAction)

    let response: AccessEvaluationResponse

    try {
      response = await authorizationClient.evaluate(request, requestId)
    } catch {
      // PDPが判断できなかった場合はALLOWと推測せず処理を止める（Fail Closed）。
      // PolicyによるDENYとは区別し、NOT_EVALUATED / 503として返す。
      return c.json(
        {
          decision: 'NOT_EVALUATED',
          reason: 'PDP_UNAVAILABLE',
          requestId,
          authzenRequest: request,
        },
        503,
      )
    }

    // decision: falseはPDPが正常にPolicyを評価した結果としてのDENY。
    if (!response.decision) {
      return c.json(
        {
          decision: 'DENY',
          requestId,
          authzenRequest: request,
          authzenResponse: response,
        },
        403,
      )
    }

    const trace: AuthorizationTrace = {
      requestId,
      request,
      response,
    }

    c.set('documentAction', rawAction)
    c.set('authorizationTrace', trace)

    // decision: trueの場合だけBusiness Handlerへ進める。
    await next()
  })
