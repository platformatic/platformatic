import { getUndiciThreadInterceptor, updateGlobals } from '@platformatic/globals'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { Agent, createServer } from 'node:http'
import { test } from 'node:test'
import { WebSocket } from 'ws'
import { createFromConfig } from './helper.js'

test('should close upstream sockets after a rejected WebSocket upgrade', async t => {
  const originalInterceptor = getUndiciThreadInterceptor({ throwOnMissing: false })
  const agent = new Agent({ keepAlive: false })
  updateGlobals({ undiciThreadInterceptor: { createUpgradeAgent: () => agent } })
  t.after(() => {
    updateGlobals({ undiciThreadInterceptor: originalInterceptor })
    agent.destroy()
  })

  const upstream = createServer()
  let upstreamSocket
  upstream.on('upgrade', (_, socket) => {
    upstreamSocket = socket
    // Reject the upgrade but leave the response incomplete, as a stalled
    // development server can do while serving an unsupported HMR path.
    socket.write('HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\n')
    socket.resume()
  })
  t.after(() => {
    upstreamSocket?.destroy()
    upstream.close()
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [{
        id: 'upstream',
        proxy: {
          prefix: '/',
          upstream: `http://127.0.0.1:${upstream.address().port}`,
          ws: { upstream: `ws://127.0.0.1:${upstream.address().port}` }
        }
      }]
    }
  })
  const address = await gateway.start({ listen: true })
  const client = new WebSocket(address.replace('http:', 'ws:'))
  t.after(() => client.terminate())
  await once(client, 'close')

  assert.ok(upstreamSocket)
  const socket = Object.values(agent.sockets).flat()[0]
  assert.ok(socket && !socket.destroyed, 'The rejected upgrade left a pending upstream socket')
  const closed = once(socket, 'close', { signal: AbortSignal.timeout(5000) })
  await gateway.stop()
  await closed
})
