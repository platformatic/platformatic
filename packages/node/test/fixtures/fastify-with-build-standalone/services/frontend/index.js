import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import fastify from 'fastify'

export function build () {
  const app = fastify({
    loggerInstance: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
  })

  app.addHook('onClose', async () => {
    globalThis.platformatic?.events.emitAndNotify('fastify:close')
  })

  const prefix = globalThis.platformatic?.basePath ?? ''

  app.get(ensureTrailingSlash(cleanBasePath(prefix)), async () => {
    return { production: process.env.NODE_ENV === 'production' }
  })

  return app
}
