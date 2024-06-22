'use strict'

const { deepStrictEqual, strictEqual, fail, notEqual, throws } = require('node:assert')
const { once } = require('node:events')
const { isMainThread, parentPort, workerData, Worker } = require('node:worker_threads')
const { test } = require('node:test')
const { Bus } = require('..')

function runWorker () {
  const bus = new Bus(workerData.id)

  bus.on('message', message => {
    notEqual(message.destination, 'third')
  })

  bus.on('message', message => {
    deepStrictEqual(message, {
      source: '$root',
      destination: '*',
      type: 'ping',
      data: { label: 'name' }
    })

    bus.send('$root', 'pong', message)

    // No bus has this id so it should not be processed
    bus.send('third', 'pong', message)
  })

  bus.on('ping', message => {
    deepStrictEqual(message, {
      source: '$root',
      destination: '*',
      type: 'ping',
      data: { label: 'name' }
    })

    bus.send('$root', 'pong', message)
  })

  bus.on('another', message => {
    fail('another messages should not be handled')
  })

  parentPort.postMessage('ready')
  once(parentPort, 'message')
}

function runTest () {
  const first = new Worker(__filename, { workerData: { id: 'first' } })
  const second = new Worker(__filename, { workerData: { id: 'second' } })

  test('should properly send and receive messages', async function () {
    await Promise.all([once(first, 'message'), once(second, 'message')])

    const pongs = []
    const bus = new Bus('$root')
    bus.broadcast('ping', { label: 'name' })

    throws(() => bus.broadcast('error'), { code: 'PLT_BUS_INVALID_ARGUMENT' })

    bus.on('message', function (message) {
      pongs.push(message)

      if (pongs.length < 4) {
        return
      }

      const firstPongs = pongs.filter(m => m.source === 'first')
      const secondPongs = pongs.filter(m => m.source === 'second')
      const otherPongs = pongs.filter(m => m.source !== 'first' && m.source !== 'second')

      strictEqual(firstPongs.length, 2)
      strictEqual(secondPongs.length, 2)
      strictEqual(otherPongs.length, 0)

      deepStrictEqual(firstPongs[0], {
        source: 'first',
        destination: '$root',
        type: 'pong',
        data: {
          source: '$root',
          destination: '*',
          type: 'ping',
          data: { label: 'name' }
        }
      })

      deepStrictEqual(secondPongs[0], {
        source: 'second',
        destination: '$root',
        type: 'pong',
        data: {
          source: '$root',
          destination: '*',
          type: 'ping',
          data: { label: 'name' }
        }
      })

      first.postMessage('done')
      second.postMessage('done')
      bus.close()
    })

    await Promise.all([once(first, 'exit'), once(second, 'exit')])
  })
}

if (isMainThread) {
  runTest()
} else {
  runWorker()
}
