import { updateGlobals } from '@platformatic/globals'
import { deepStrictEqual } from 'node:assert'
import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'
import { setupLoopbackMessaging } from '../../runtime/index.js'
import { create as createLoopbackTestApplication } from './fixtures/close-background-with-factory/services/frontend/index.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('supports pure IPC applications', async t => {
  const { runtime } = await prepareRuntime(t, 'messaging')
  const url = await startRuntime(t, runtime)

  const res = await fetch(`${url}/abcde`)

  deepStrictEqual(res.status, 200)
  deepStrictEqual(await res.json(), { url: 'edcba/' })
})

test('supports loopback messaging for background factory applications', async t => {
  const events = new EventEmitter()
  events.emitAndNotify = events.emit.bind(events)
  updateGlobals({ events })

  const messaging = setupLoopbackMessaging('frontend', { globals: { events } })

  messaging.handle('from-target', payload => {
    return { received: payload }
  })

  const app = await createLoopbackTestApplication()

  t.after(() => {
    messaging.unmount()
    return app.close(app)
  })

  deepStrictEqual(await messaging.send('frontend', 'ping', { hello: 'world' }), { pong: { hello: 'world' } })
  deepStrictEqual(await messaging.send('frontend', 'callClient', { hello: 'client' }), {
    received: { hello: 'client' }
  })

  const buffer = new ArrayBuffer(8)
  deepStrictEqual(await messaging.send('frontend', 'buffer', { buffer }, { transferList: [buffer] }), 8)
  deepStrictEqual(buffer.byteLength, 0)
})
