import { abstractLogger } from '@platformatic/foundation'
import { deepStrictEqual, strictEqual, rejects } from 'node:assert'
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

test('should honor the signal passed by the caller', async t => {
  const { channel, sender, target, targetId } = setupMessagingPair(t, 10000)
  const handlerStarted = Promise.withResolvers()
  const handlerRelease = Promise.withResolvers()

  target.handle('slow', async () => {
    handlerStarted.resolve()
    return handlerRelease.promise
  })

  const abortController = new AbortController()
  const abortReason = new Error('Caller gave up')
  const response = sender.send(targetId, 'slow', null, { signal: abortController.signal })
  await handlerStarted.promise

  abortController.abort(abortReason)

  await rejects(response, error => {
    strictEqual(error, abortReason)
    return true
  })
  strictEqual(getPendingResponses(channel).size, 0)

  handlerRelease.resolve('late-response')
  await nextImmediate()
})

// Sanitizing reads every property once and posting reads it again,
// so the number of reads of a getter tells whether a message was sanitized.
function trackReads () {
  const tracker = { reads: 0 }

  tracker.data = {
    get value () {
      tracker.reads++
      return 'value'
    }
  }

  return tracker
}

test('should post the results of handlers registered with sanitize: false as they are', async t => {
  const { sender, target, targetId } = setupMessagingPair(t)
  const sanitized = trackReads()
  const single = trackReads()
  const first = trackReads()
  const second = trackReads()

  target.handle('sanitized', () => sanitized.data)
  target.handle('single', () => single.data, { sanitize: false })
  target.handle({ first: () => first.data, second: () => second.data }, { sanitize: false })

  for (const name of ['sanitized', 'single', 'first', 'second']) {
    deepStrictEqual(await sender.send(targetId, name), { value: 'value' })
  }

  strictEqual(sanitized.reads, 2)
  strictEqual(single.reads, 1)
  strictEqual(first.reads, 1)
  strictEqual(second.reads, 1)
})

test('should post a message sent with sanitize: false as it is', async t => {
  const { sender, target, targetId } = setupMessagingPair(t)
  const sanitized = trackReads()
  const unsanitized = trackReads()

  const requests = []
  target.handle('echo', message => {
    requests.push(message)
    return null
  })

  await sender.send(targetId, 'echo', sanitized.data)
  await sender.send(targetId, 'echo', unsanitized.data, { sanitize: false })

  deepStrictEqual(requests, [{ value: 'value' }, { value: 'value' }])
  strictEqual(sanitized.reads, 2)
  strictEqual(unsanitized.reads, 1)
})

test('should sanitize a message sent with sanitize: false that cannot be cloned', async t => {
  const { sender, target, targetId } = setupMessagingPair(t)

  target.handle('echo', message => ({ ...message, drop () {} }), { sanitize: false })

  const response = await sender.send(targetId, 'echo', { keep: 'yes', drop: Symbol('drop') }, { sanitize: false })

  deepStrictEqual(response, { keep: 'yes' })
})

test('should post a notification with sanitize: false as it is', async t => {
  const { sender, target, targetId } = setupMessagingPair(t)
  const sanitized = trackReads()
  const unsanitized = trackReads()

  const notifications = []
  let received = Promise.withResolvers()
  target.handle('notification', message => {
    notifications.push(message)
    received.resolve()
  })

  sender.notify(targetId, 'notification', sanitized.data)
  await received.promise

  received = Promise.withResolvers()
  sender.notify(targetId, 'notification', unsanitized.data, { sanitize: false })
  await received.promise

  received = Promise.withResolvers()
  sender.notify(targetId, 'notification', { keep: 'yes', drop () {} }, { sanitize: false })
  await received.promise

  deepStrictEqual(notifications, [{ value: 'value' }, { value: 'value' }, { keep: 'yes' }])
  strictEqual(sanitized.reads, 2)
  strictEqual(unsanitized.reads, 1)
})
