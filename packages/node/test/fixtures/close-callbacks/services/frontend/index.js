import { createServer } from 'node:http'
import { getEvents, getITC, registerCloseCallback } from '@platformatic/globals'
import { strictEqual } from 'node:assert'
import { setTimeout as sleep } from 'node:timers/promises'

const events = getEvents()
let failCleanup = false

registerCloseCallback(async () => {
  strictEqual(server.listening, false)
  events.emitAndNotify('callback:first')
})

registerCloseCallback(async () => {
  await sleep(20)
  events.emitAndNotify('callback:second')
  process.once('SIGINT', () => {
    events.emitAndNotify('signal')
    // Signal dispatch must not inspect or consume a listener's return value.
    return { then () { events.emitAndNotify('signal:then') } }
  })
  if (failCleanup) {
    throw Object.assign(new Error('cleanup failed'), { code: 'TEST_CLEANUP' })
  }
})

const server = createServer((req, res) => {
  res.end('ok')
  if (req.url.startsWith('/duplicates')) {
    failCleanup = req.url === '/duplicates-fail'
    setImmediate(async () => {
      const stop = getITC().getHandler('stop')
      const results = await Promise.allSettled([stop({ force: true }), stop({ force: true })])
      for (const result of results) {
        strictEqual(result.status, failCleanup ? 'rejected' : 'fulfilled')
        if (failCleanup) {
          strictEqual(result.reason.code, 'PLT_RUNTIME_APPLICATION_SHUTDOWN')
        }
      }
      events.emitAndNotify('duplicates:finished')
    })
  }
})

server.listen(0)
