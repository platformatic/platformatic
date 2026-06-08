import { getLogLevel, getLogger, setBasePath } from '@platformatic/globals'
import fastify from 'fastify'

setBasePath('/nested/base/dir')

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({}, { level: getLogLevel(false) ?? 'info' })
})

app.get('/nested/base/dir/', async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

app.get('/nested/base/dir/direct', async () => {
  return { ok: true }
})

app.get('/nested/base/dir/time', async () => {
  const response = await fetch('http://backend.plt.local/time')
  return response.json()
})

// This would likely fail if our code doesn't work
app.listen({ port: 0 })
