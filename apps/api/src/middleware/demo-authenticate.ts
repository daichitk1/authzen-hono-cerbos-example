import { findDemoSubject } from '@authzen-demo/domain'
import { createMiddleware } from 'hono/factory'

import type { AppEnv } from '../pep/types.js'

export const demoAuthenticate = createMiddleware<AppEnv>(async (c, next) => {
  // DemoではClientが指定できるのはSubject IDだけ。
  // RoleまでClientから受け取ると「自分はadmin」と自己申告できるため、Server-side mapから解決する。
  const subjectId = c.req.header('X-Demo-Subject')
  const subject = subjectId ? findDemoSubject(subjectId) : undefined

  if (!subject) {
    return c.json(
      {
        error: 'UNAUTHENTICATED_DEMO_SUBJECT',
        message: 'X-Demo-Subject must be yuki, ren, or admin.',
      },
      401,
    )
  }

  // 後続MiddlewareはClient入力ではなく、ここで解決済みのSubjectを認可判断に使う。
  c.set('currentUser', subject)
  await next()
})
