import fastify from 'fastify'
import { request } from 'undici'

const app = fastify({
  loggerInstance: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
})

app.get('/', async () => {
  const responses = []

  // Note: c.plt.local does not exist so it should trigger a failure
  for (const url of ['http://a.plt.local/id', 'http://b.plt.local/id', 'http://c.plt.local/id']) {
    try {
      const response = await fetch(url)
      const body = await response.json()

      responses.push({ statusCode: response.status, body })
    } catch (e) {
      responses.push({ error: { message: e.message, stack: e.stack.split('\n')[0] } })
    }
  }

  {
    const { statusCode, headers, body } = await request('http://a.plt.local/echo', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-plt-custom': '123'
      },
      body: Buffer.from('echo'.repeat(10))
    })

    responses.push({
      statusCode,
      body: `${headers['content-type']}:${headers['x-plt-custom']}:${await body.text()}`
    })
  }

  return { pid: process.pid, responses }
})

// This would likely fail if our code doesn't work
app.listen({ port: 1 })
