import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { updateGlobals } from '@platformatic/globals'
import { closeApplicationChannels, closeITC } from '../lib/worker/itc.js'

test('internal shutdown attempts every resource after failures', async () => {
  const order = []
  const failures = [null, Object.create(null)]
  const events = new EventEmitter()
  updateGlobals({ events })
  events.on('exit', () => order.push('exit'))
  await rejects(closeApplicationChannels({
    // Exercise cleanup rejecting with a non-Error value.
    interceptor: { async close () { order.push('interceptor'); return Promise.reject(failures[0]) } },
    server: { async close () { order.push('server'); throw failures[1] } }
  }, {
    close () { order.push('messaging') }
  }), error => {
    strictEqual(error.code, 'PLT_RUNTIME_APPLICATION_SHUTDOWN')
    strictEqual(error instanceof AggregateError, true)
    deepStrictEqual(error.errors, failures)
    return true
  })
  await closeITC({ close () { order.push('itc') } })
  deepStrictEqual(order, ['interceptor', 'server', 'messaging', 'itc', 'exit'])
})
