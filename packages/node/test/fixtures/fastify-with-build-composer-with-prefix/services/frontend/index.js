import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import fastify from 'fastify'

export function build () {
  const app = fastify({
    loggerInstance: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
  })

  const prefix = globalThis.platformatic?.basePath ?? ''

  app.get(ensureTrailingSlash(cleanBasePath(prefix)), async () => {
    return { production: process.env.NODE_ENV === 'production' }
  })

  app.get(cleanBasePath(`${prefix}/direct`), async () => {
    return { ok: true }
  })

  app.get(cleanBasePath(`${prefix}/time`), async () => {
    const response = await fetch('http://backend.plt.local/time')
    return response.json()
  })

  return app
}
