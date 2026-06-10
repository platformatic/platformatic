import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath } from '@platformatic/globals'
import Koa from 'koa'

export function build () {
  const app = new Koa()
  const prefix = getBasePath({ throwOnMissing: false }) ?? ''

  app.use(async ctx => {
    if (ctx.request.url === ensureTrailingSlash(cleanBasePath(prefix))) {
      ctx.body = { production: process.env.NODE_ENV === 'production' }
    } else {
      ctx.throw(404, { ok: false })
    }
  })

  return app
}
