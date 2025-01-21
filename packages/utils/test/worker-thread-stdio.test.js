'use strict'

const { strictEqual } = require('node:assert')
const { once } = require('node:events')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { Worker } = require('node:worker_threads')

test('flushes all logs', async t => {
  const worker = new Worker(resolve(__dirname, './fixtures/worker-stdio-flush.js'), {
    stdout: true
  })

  let data = ''
  worker.stdout.setEncoding('utf8')
  worker.stdout.on('data', chunk => {
    data += chunk
  })

  await once(worker, 'exit')

  strictEqual(data, 'hello world')
})

test('flushes all inflight logs', async t => {
  const worker = new Worker(resolve(__dirname, './fixtures/worker-stdio-flush-inflight.js'), {
    stdout: true
  })

  let data = ''
  worker.stderr.setEncoding('utf8')
  worker.stderr.on('data', chunk => {
    data += chunk
  })

  await once(worker, 'exit')

  strictEqual(data, 'hello world\n')
})
