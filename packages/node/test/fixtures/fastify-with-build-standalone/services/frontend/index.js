import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath, getEvents, getLogLevel, getLogger } from '@platformatic/globals'
import fastify from 'fastify'

export function build () {
  const logger = getLogger()
  const app = fastify({
    loggerInstance: logger.child({}, { level: getLogLevel(false) ?? 'info' })
  })

  app.addHook('onClose', async () => {
    const events = getEvents()
    events.emitAndNotify('fastify:close')
  })

  const prefix = getBasePath(false) ?? ''

  app.get(ensureTrailingSlash(cleanBasePath(prefix)), async () => {
    return { production: process.env.NODE_ENV === 'production' }
  })

  return app
}
