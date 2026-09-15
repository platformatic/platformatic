import { deepStrictEqual, rejects } from 'node:assert'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { updateGlobals } from '@platformatic/globals'
import { closeITC } from '../lib/worker/itc.js'

test('internal shutdown attempts every resource after failures', async () => {
  const order = []
  const events = new EventEmitter()
  updateGlobals({ events })
  events.on('exit', () => order.push('exit'))
  await rejects(closeITC({
    // Exercise cleanup rejecting with a non-Error value.
    // eslint-disable-next-line prefer-promise-reject-errors
    interceptor: { async close () { order.push('interceptor'); return Promise.reject(null) } },
    server: { async close () { order.push('server'); throw Object.create(null) } }
  }, {
    close () { order.push('itc') }
  }, {
    close () { order.push('messaging') }
  }), {
    code: 'PLT_RUNTIME_APPLICATION_SHUTDOWN',
    message: 'Application shutdown failed: null; Unprintable shutdown rejection'
  })
  deepStrictEqual(order, ['interceptor', 'server', 'itc', 'messaging', 'exit'])
})
