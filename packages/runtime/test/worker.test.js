'use strict'

const assert = require('node:assert')
const { once } = require('node:events')
const { join } = require('node:path')
const { test } = require('node:test')
const { Worker } = require('node:worker_threads')

test('throws if unknown messages are received', async (t) => {
  const workerFile = join(__dirname, '..', 'lib', 'worker.js')
  const worker = new Worker(workerFile, {
    execArgv: [],
    workerData: { config: { services: [] } }
  })

  const [msg] = await once(worker, 'message')
  assert.strictEqual(msg, 'plt:init')
  worker.postMessage({ msg: 'unknown-message-type' })
  const [err] = await once(worker, 'error')
  assert.strictEqual(err.message, 'unknown message type: \'unknown-message-type\'')
})
