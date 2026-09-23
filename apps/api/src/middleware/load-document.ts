import { findDemoDocument } from '@authzen-demo/domain'
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../pep/types.js'

export const loadDocument = createMiddleware<AppEnv>(async (c, next) => {
  // URL ParameterはResourceを特定するためにだけ使う。
  // Owner判定に必要なownerIdなどの属性はServer-side Resourceから取得する。
  const documentId = c.req.param('id')
  const document = documentId ? findDemoDocument(documentId) : undefined

  if (!document) {
    return c.json(
      {
        error: 'DOCUMENT_NOT_FOUND',
      },
      404,
    )
  }

  // authorizeDocumentとBusiness Handlerが同じ信頼済みResourceを再利用する。
  c.set('document', document)
  await next()
})
