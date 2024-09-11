import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import fastify from 'fastify'

const app = fastify({
  logger: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
})

const prefix = globalThis.platformatic?.basePath ?? ''

app.get(ensureTrailingSlash(cleanBasePath(prefix)), async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

// This would likely fail if our code doesn't work
app.listen({ port: 1 })
