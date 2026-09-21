import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import { getBasePath, getLogLevel, getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({}, { level: getLogLevel({ throwOnMissing: false }) ?? 'info' })
})

const prefix = getBasePath({ throwOnMissing: false }) ?? ''

app.get(ensureTrailingSlash(cleanBasePath(prefix)), async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

// This would likely fail if our code doesn't work
app.listen({ port: 0 })
