import { getEvents, getMessaging } from '@platformatic/globals'
import { strictEqual } from 'node:assert'
import { createServer } from 'node:http'

async function communicate () {
  const results = await Promise.all([
    fetch('http://backend.plt.local/').then(response => response.text()),
    getMessaging().send('backend', 'ping')
  ])
  for (const result of results) {
    strictEqual(result, 'pong')
  }
}

process.once('SIGINT', () => {
  // Start I/O after signal dispatch returns, without returning a promise to Watt.
  setTimeout(() => {
    communicate().then(() => getEvents().emitAndNotify('signal:io:finished'))
  }, 50)
})

export function create () {
  if (process.env.FAIL_START) {
    throw Object.assign(new Error('Startup failed before signal I/O'), { code: 'TEST_SIGNAL_IO_START' })
  }
  const server = createServer(async (req, res) => {
    if (req.url === '/warm') {
      await communicate()
    }
    res.end('ok')
  })
  server.listen(0)
  return server
}
