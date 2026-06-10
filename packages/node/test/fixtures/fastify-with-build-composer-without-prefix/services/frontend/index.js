import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath, getLogLevel, getLogger } from '@platformatic/globals'
import fastify from 'fastify'

export function build () {
  const logger = getLogger()
  const app = fastify({
    loggerInstance: logger.child({}, { level: getLogLevel({ throwOnMissing: false }) ?? 'info' })
  })

  const prefix = getBasePath({ throwOnMissing: false }) ?? ''

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
