import { abstractLogger } from '@platformatic/foundation'
import { strictEqual, rejects } from 'node:assert'
import { randomUUID } from 'node:crypto'
import { setImmediate as nextImmediate } from 'node:timers/promises'
import { MessageChannel } from 'node:worker_threads'
import { test } from 'node:test'
import { MessagingITC } from '../lib/worker/messaging.js'

const kPendingResponsesDescription = 'plt.messaging.pendingResponses'

class TestMessagingITC extends MessagingITC {
  #worker

  constructor (id, application, runtimeConfig, channel) {
    super(id, runtimeConfig, abstractLogger)

    this.#worker = { application, channel }
    this.addSource(channel)
  }

  _getNextWorker () {
    return this.#worker
  }
}

function setupMessagingPair (t, messagingTimeout = 1000) {
  const id = randomUUID()
  const senderId = `sender-${id}`
  const targetId = `target-${id}`
  const channel = new MessageChannel()
  const runtimeConfig = { messagingTimeout }

  const sender = new TestMessagingITC(senderId, targetId, runtimeConfig, channel.port1)
  const target = new TestMessagingITC(targetId, senderId, runtimeConfig, channel.port2)

  t.after(() => {
    sender.close()
    target.close()
    channel.port1.close()
    channel.port2.close()
  })

  return { channel: channel.port1, sender, target, targetId }
}

function getPendingResponses (channel) {
  const symbol = Object.getOwnPropertySymbols(channel).find(symbol => {
    return symbol.description === kPendingResponsesDescription
  })

  return channel[symbol]
}

test('should release tracked requests after receiving responses', async t => {
  const { channel, sender, target, targetId } = setupMessagingPair(t)

  target.handle('echo', message => message)

  const requests = Array.from({ length: 100 }, (_, id) => {
    return sender.send(targetId, 'echo', { id, payload: 'x'.repeat(4096) })
  })

  await Promise.all(requests)

  strictEqual(getPendingResponses(channel).size, 0)
})

test('should release tracked requests after a timeout', async t => {
  const { channel, sender, target, targetId } = setupMessagingPair(t, 50)
  const handlerStarted = Promise.withResolvers()
  const handlerRelease = Promise.withResolvers()

  target.handle('slow', async () => {
    handlerStarted.resolve()
    return handlerRelease.promise
  })

  const response = sender.send(targetId, 'slow')
  await handlerStarted.promise

  await rejects(response, /Timeout while waiting for a response/)
  strictEqual(getPendingResponses(channel).size, 0)

  handlerRelease.resolve('late-response')
  await nextImmediate()
})
