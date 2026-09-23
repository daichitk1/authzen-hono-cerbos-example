import { serve } from '@hono/node-server'

import { app } from './index.js'

const port = Number.parseInt(process.env.API_PORT ?? '8787', 10)

serve(
  {
    fetch: app.fetch,
    hostname: '127.0.0.1',
    port,
  },
  (info) => {
    console.log(`AuthZEN demo API listening on http://127.0.0.1:${info.port}`)
  },
)
