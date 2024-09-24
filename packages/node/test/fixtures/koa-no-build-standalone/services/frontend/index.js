import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import Koa from 'koa'

const app = new Koa()
const prefix = globalThis.platformatic?.basePath ?? ''

app.use(async ctx => {
  if (ctx.request.url === ensureTrailingSlash(cleanBasePath(prefix))) {
    ctx.body = { production: process.env.NODE_ENV === 'production' }
  } else {
    ctx.throw(404, { ok: false })
  }
})

// This would likely fail if our code doesn't work
app.listen(1)
