import { deepStrictEqual, fail, ifError, rejects, throws } from 'node:assert'
import { once } from 'node:events'
import { test } from 'node:test'
import { setImmediate as nextImmediate, setTimeout as sleep } from 'node:timers/promises'
import { MessageChannel, Worker } from 'node:worker_threads'
import { generateRequest, generateResponse, ITC, sanitize } from '../lib/index.js'
import { BatchingITC, generateItcRequest, generateItcResponse } from './helper.js'

test('should send a request between threads', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message' }
  const testResponse = { test: 'test-res-message' }

  const requests = []
  itc2.handle(requestName, async request => {
    requests.push(request)
    return testResponse
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  deepStrictEqual(response, testResponse)
  deepStrictEqual(requests, [testRequest])
})

test('should abort a pending request', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })
  const handlerStarted = Promise.withResolvers()
  const handlerRelease = Promise.withResolvers()

  itc2.handle('test-command', async () => {
    handlerStarted.resolve()
    return handlerRelease.promise
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const abortController = new AbortController()
  const abortReason = new Error('Request aborted')
  const response = itc1.send('test-command', 'test-request', { signal: abortController.signal })

  await handlerStarted.promise
  abortController.abort(abortReason)

  await rejects(response, error => {
    deepStrictEqual(error, abortReason)
    return true
  })

  handlerRelease.resolve('late-response')
})

test('should support close while replying to a message', async t => {
  const { port1, port2 } = new MessageChannel()

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message' }
  const testResponse = { test: 'test-res-message' }

  const requests = []

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({
    port: port2,
    name: 'itc2',
    handlers: {
      [requestName] (request) {
        requests.push(request)
        itc2.close()
        return testResponse
      }
    }
  })

  itc2.handle()

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  deepStrictEqual(response, testResponse)
  deepStrictEqual(requests, [testRequest])
})

test('should throw an error if send req before listen', async t => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1, name: 'itc' })
  t.after(() => itc.close())

  try {
    await itc.send('test', 'test-request')
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_SEND_BEFORE_LISTEN')
    deepStrictEqual(error.message, 'ITC cannot send requests before listening')
  }
})

test('should throw an error if request name is not a string', async t => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1, name: 'itc' })
  t.after(() => itc.close())

  itc.listen()

  try {
    await itc.send(true, 'test-request')
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_REQUEST_NAME_IS_NOT_STRING')
    deepStrictEqual(error.message, 'ITC request name is not a string: "true"')
  }
})

test('should send a notification between threads', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const notificationName = 'notification'
  const testNotification = { test: 'test-notification' }

  t.after(() => itc2.close())
  await itc2.listen()

  const notification = once(itc2, notificationName)
  await itc1.notify(notificationName, testNotification)
  const [receivedNotification] = await notification
  deepStrictEqual(testNotification, receivedNotification)
})

test('should throw if call listen twice', async t => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1, name: 'itc' })
  t.after(() => itc.close())

  itc.listen()

  try {
    itc.listen()
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_ALREADY_LISTENING')
    deepStrictEqual(error.message, 'ITC is already listening')
  }
})

test('should throw an error if handler fails', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'

  itc2.handle(requestName, async () => {
    throw new Error('test-error')
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  try {
    await itc1.send(requestName, 'test-request')
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_HANDLER_FAILED')
    deepStrictEqual(error.message, 'Handler failed with error: test-error')
    deepStrictEqual(error.handlerError.message, 'test-error')
  }
})

test('should throw if handler is not found', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  try {
    await itc1.send(requestName, 'test-request')
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_HANDLER_NOT_FOUND')
    deepStrictEqual(error.message, 'Handler not found for request: "test-command"')
  }
})

test('should allow missing handlers using throwOnMissingHandler', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, throwOnMissingHandler: false, name: 'itc2' })

  const requestName = 'test-command'

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  ifError(await itc1.send(requestName, 'test-request'))
})

test('should process a local request', async t => {
  const { port1 } = new MessageChannel()
  const itc = new ITC({ port: port1, name: 'itc' })
  const context = { hello: 'world' }

  t.after(() => itc.close())

  itc.handle('test-command', async (request, handlerContext) => {
    deepStrictEqual(handlerContext, context)
    return { request }
  })

  deepStrictEqual(await itc.process('test-command', { ok: true }, context), { request: { ok: true } })
})

test('should skip non-platformatic message', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requests = []
  itc1.handle('test', async request => {
    requests.push(request)
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  port2.postMessage({ type: 'test' })
  port2.postMessage({ type: 'platformatic' })
  port2.postMessage({ type: 'test' })

  await itc2.send('test', 'test-message')

  deepStrictEqual(requests, ['test-message'])
})

test('should emit unhandledError if request version is wrong', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', error => {
    deepStrictEqual(error.code, 'PLT_ITC_INVALID_REQUEST_VERSION')
    deepStrictEqual(error.message, 'Invalid ITC request version: "0.0.0"')
    done()
  })

  const itcRequest = generateItcRequest({ version: '0.0.0' })
  port2.postMessage(itcRequest)
})

test('should emit unhandledError if request reqId is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', error => {
    deepStrictEqual(error.code, 'PLT_ITC_MISSING_REQUEST_REQ_ID')
    deepStrictEqual(error.message, 'ITC request reqId is missing')
    done()
  })

  const itcRequest = generateItcRequest()
  delete itcRequest.reqId

  port2.postMessage(itcRequest)
})

test('should emit unhandledError if request name is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', error => {
    deepStrictEqual(error.code, 'PLT_ITC_MISSING_REQUEST_NAME')
    deepStrictEqual(error.message, 'ITC request name is missing')
    done()
  })

  const itcRequest = generateItcRequest()
  delete itcRequest.name

  port2.postMessage(itcRequest)
})

test('should emit unhandledError if response version is wrong', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', error => {
    deepStrictEqual(error.code, 'PLT_ITC_INVALID_RESPONSE_VERSION')
    deepStrictEqual(error.message, 'Invalid ITC response version: "0.0.0"')
    done()
  })

  const itcResponse = generateItcResponse({ version: '0.0.0' })
  port2.postMessage(itcResponse)
})

test('should emit unhandledError if response reqId is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', error => {
    deepStrictEqual(error.code, 'PLT_ITC_MISSING_RESPONSE_REQ_ID')
    deepStrictEqual(error.message, 'ITC response reqId is missing')
    done()
  })

  const itcResponse = generateItcResponse()
  delete itcResponse.reqId

  port2.postMessage(itcResponse)
})

test('should emit unhandledError if response name is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', error => {
    deepStrictEqual(error.code, 'PLT_ITC_MISSING_RESPONSE_NAME')
    deepStrictEqual(error.message, 'ITC response name is missing')
    done()
  })

  const itcResponse = generateItcResponse()
  delete itcResponse.name

  port2.postMessage(itcResponse)
})

test('should sanitize a request before sending', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'
  const testRequest = {
    test: 'test-req-message',
    foo: () => {},
    bar: Symbol('test'),
    nested: {
      test: 'test-req-message',
      foo: () => {},
      bar: Symbol('test')
    },
    array: [1, 2, { a: 1 }]
  }
  const testResponse = { test: 'test-res-message' }

  const requests = []
  itc2.handle(requestName, async request => {
    requests.push(request)
    return testResponse
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  deepStrictEqual(response, testResponse)
  deepStrictEqual(requests, [
    {
      test: 'test-req-message',
      nested: { test: 'test-req-message' },
      array: [1, 2, { a: 1 }]
    }
  ])
})

test('should throw if receiver ITC port was closed', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message' }

  itc2.handle(requestName, async () => {
    await sleep(10000)
    fail('Handler should not be called')
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  port2.close()

  try {
    await itc1.send(requestName, testRequest)
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_MESSAGE_PORT_CLOSED')
    deepStrictEqual(error.message, 'ITC MessagePort is closed')
  }
})

test('should throw if sender ITC port was closed', async t => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1, name: 'itc' })
  itc.listen()

  port1.close()

  try {
    await itc.send('test-command', 'test-req-message')
    fail('Expected an error to be thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_MESSAGE_PORT_CLOSED')
    deepStrictEqual(error.message, 'ITC MessagePort is closed')
  }
})

test('should throw if ITC is created without a name', async t => {
  throws(() => new ITC({}))
})

test('should send a Buffer through', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message', buffer: Buffer.from('test-request') }

  const testResponse = { test: 'test-res-message', buffer: Buffer.from('test-response') }

  const requests = []
  itc2.handle(requestName, async request => {
    requests.push(request)
    return testResponse
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  deepStrictEqual(Buffer.from(response.buffer), Buffer.from('test-response'))
  deepStrictEqual(Buffer.from(requests[0].buffer), Buffer.from('test-request'))
})

test('should allow to get handlers', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message' }
  const testResponse = { test: 'test-res-message' }

  const fn = async request => {
    requests.push(request)
    return testResponse
  }

  const requests = []
  itc2.handle(requestName, fn)
  deepStrictEqual(itc2.getHandler(requestName), fn)

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  deepStrictEqual(response, testResponse)
  deepStrictEqual(requests, [testRequest])
})

test('should sanitize errors with function properties (e.g. avvio plugin timeout)', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'

  itc2.handle(requestName, async () => {
    const error = new Error('Plugin did not start in time')
    error.code = 'AVV_ERR_PLUGIN_EXEC_TIMEOUT'
    // Avvio attaches the plugin function to the error
    error.fn = async function myPlugin () {}
    throw error
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  try {
    await itc1.send(requestName)
    fail('should have thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_HANDLER_FAILED')
    deepStrictEqual(error.handlerErrorCode, 'AVV_ERR_PLUGIN_EXEC_TIMEOUT')
  }
})

test('should sanitize errors with nested non-cloneable properties', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  const requestName = 'test-command'

  itc2.handle(requestName, async () => {
    const error = new Error('test error')
    error.code = 'TEST_ERROR'
    error.details = { callback: () => {}, info: 'some info' }
    throw error
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  try {
    await itc1.send(requestName)
    fail('should have thrown')
  } catch (error) {
    deepStrictEqual(error.code, 'PLT_ITC_HANDLER_FAILED')
    deepStrictEqual(error.handlerErrorCode, 'TEST_ERROR')
  }
})

test('should fail a request with a timeout error when no response arrives in time', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })
  const handlerRelease = Promise.withResolvers()

  itc2.handle('slow-command', () => handlerRelease.promise)

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  await rejects(itc1.send('slow-command', null, { timeout: 50 }), error => {
    deepStrictEqual(error.code, 'PLT_ITC_REQUEST_TIMEOUT')
    deepStrictEqual(error.message, 'ITC request "slow-command" timed out after 50 milliseconds')
    return true
  })

  handlerRelease.resolve('late-response')
})

test('should not time out a request answered in time', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  itc2.handle('test-command', () => 'test-response')

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  deepStrictEqual(await itc1.send('test-command', null, { timeout: 1000 }), 'test-response')
})

test('should fail every pending request when the port closes', async t => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })
  const handlerStarted = Promise.withResolvers()
  let started = 0

  itc2.handle('test-command', () => {
    if (++started === 3) {
      handlerStarted.resolve()
    }

    return new Promise(() => {})
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const responses = [itc1.send('test-command', 1), itc1.send('test-command', 2), itc1.send('test-command', 3)]

  await handlerStarted.promise
  port2.close()

  for (const response of responses) {
    await rejects(response, error => {
      deepStrictEqual(error.code, 'PLT_ITC_MESSAGE_PORT_CLOSED')
      return true
    })
  }
})

test('should use unique request ids', () => {
  const ids = new Set()

  for (let i = 0; i < 1000; i++) {
    ids.add(generateRequest('test-command', null).reqId)
  }

  deepStrictEqual(ids.size, 1000)
})

test('should keep dates and typed arrays as they are when sanitizing', () => {
  const date = new Date('2026-11-20T15:08:00.000Z')
  const floats = new Float64Array([1.5, 2.5])
  const view = new DataView(new ArrayBuffer(4))
  const data = { date, floats, view, nested: [{ date }] }

  const sanitized = sanitize(data)

  deepStrictEqual(sanitized, data)
  deepStrictEqual(sanitized.date === date, true)
  deepStrictEqual(sanitized.floats === floats, true)
  deepStrictEqual(sanitized.view === view, true)
})

test('should return the same object when nothing needs sanitizing', () => {
  const data = { a: 1, b: 'two', c: [1, 2, { d: null }], e: { f: true } }

  deepStrictEqual(sanitize(data) === data, true)
  deepStrictEqual(sanitize(data, []) === data, true)
})

test('should drop functions and symbols at any depth while keeping property order', () => {
  const transferred = new ArrayBuffer(8)
  const data = {
    first: 1,
    second: { keep: 'yes', drop: () => {} },
    third: Symbol('drop'),
    fourth: [1, () => {}, { keep: true, drop: Symbol('drop') }],
    fifth: transferred
  }

  const sanitized = sanitize(data, [transferred])

  deepStrictEqual(Object.keys(sanitized), ['first', 'second', 'fourth', 'fifth'])
  deepStrictEqual(sanitized.second, { keep: 'yes' })
  deepStrictEqual(sanitized.fourth, [1, { keep: true }])
  deepStrictEqual(sanitized.fifth === transferred, true)
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

function setupPair (t) {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new ITC({ port: port2, name: 'itc2' })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  return { itc1, itc2 }
}

test('should post the results of a handler registered with sanitize: false as they are', async t => {
  const { itc1, itc2 } = setupPair(t)
  const sanitized = trackReads()
  const unsanitized = trackReads()

  itc2.handle('sanitized', () => sanitized.data)
  itc2.handle('unsanitized', () => unsanitized.data, { sanitize: false })

  deepStrictEqual(await itc1.send('sanitized'), { value: 'value' })
  deepStrictEqual(await itc1.send('unsanitized'), { value: 'value' })
  deepStrictEqual(sanitized.reads, 2)
  deepStrictEqual(unsanitized.reads, 1)
})

test('should sanitize the results of a handler registered again without sanitize: false', async t => {
  const { itc1, itc2 } = setupPair(t)
  const tracker = trackReads()

  itc2.handle('test-command', () => tracker.data, { sanitize: false })
  itc2.handle('test-command', () => tracker.data)

  deepStrictEqual(await itc1.send('test-command'), { value: 'value' })
  deepStrictEqual(tracker.reads, 2)
})

test('should post a result with the option of the handler that returned it', async t => {
  const { itc1, itc2 } = setupPair(t)

  for (const [first, second, reads] of [
    [undefined, { sanitize: false }, 2],
    [{ sanitize: false }, undefined, 1]
  ]) {
    const tracker = trackReads()
    const started = Promise.withResolvers()
    const release = Promise.withResolvers()

    itc2.handle(
      'test-command',
      async () => {
        started.resolve()
        await release.promise
        return tracker.data
      },
      first
    )

    const response = itc1.send('test-command')
    await started.promise

    itc2.handle('test-command', () => null, second)
    release.resolve()

    deepStrictEqual(await response, { value: 'value' })
    deepStrictEqual(tracker.reads, reads)
  }
})

test('should post a request sent with sanitize: false as it is', async t => {
  const { itc1, itc2 } = setupPair(t)
  const sanitized = trackReads()
  const unsanitized = trackReads()

  const requests = []
  itc2.handle('test-command', request => {
    requests.push(request)
    return null
  })

  await itc1.send('test-command', sanitized.data)
  await itc1.send('test-command', unsanitized.data, { sanitize: false })

  deepStrictEqual(requests, [{ value: 'value' }, { value: 'value' }])
  deepStrictEqual(sanitized.reads, 2)
  deepStrictEqual(unsanitized.reads, 1)
})

test('should sanitize a message with sanitize: false that cannot be cloned', async t => {
  const { itc1, itc2 } = setupPair(t)

  const requests = []
  itc2.handle(
    'test-command',
    request => {
      requests.push(request)
      return { keep: 'response', drop () {} }
    },
    { sanitize: false }
  )

  const response = await itc1.send('test-command', { keep: 'request', drop: Symbol('drop') }, { sanitize: false })

  deepStrictEqual(response, { keep: 'response' })
  deepStrictEqual(requests, [{ keep: 'request' }])
})

test('should transfer the transfer list when posting a message with sanitize: false again', async t => {
  const { itc1, itc2 } = setupPair(t)
  const buffer = new ArrayBuffer(8)

  itc2.handle('test-command', request => request.buffer.byteLength)

  const response = await itc1.send(
    'test-command',
    { buffer, drop () {} },
    { transferList: [buffer], sanitize: false }
  )

  deepStrictEqual(response, 8)
  deepStrictEqual(buffer.byteLength, 0)
})

test('should sanitize the errors of a handler registered with sanitize: false', async t => {
  const { itc1, itc2 } = setupPair(t)

  itc2.handle(
    'test-command',
    () => {
      const error = new Error('Plugin did not start in time')
      error.code = 'AVV_ERR_PLUGIN_EXEC_TIMEOUT'
      error.fn = async function myPlugin () {}
      throw error
    },
    { sanitize: false }
  )

  await rejects(itc1.send('test-command'), error => {
    deepStrictEqual(error.code, 'PLT_ITC_HANDLER_FAILED')
    deepStrictEqual(error.handlerError.code, 'AVV_ERR_PLUGIN_EXEC_TIMEOUT')
    deepStrictEqual(error.handlerError.fn, undefined)
    return true
  })
})

function setupBatchingPair (t) {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1, name: 'itc1' })
  const itc2 = new BatchingITC({ port: port2, name: 'itc2' })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  return { itc1, itc2 }
}

test('should post the first response at once and the others of the same turn as one message, in order', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)

  itc2.handle('echo', value => value)
  itc2.handle('with-function', value => ({ value, fn () {} }))
  itc2.handle('plain', value => ({ value }), { sanitize: false })

  const settled = []
  const requests = [
    itc1.send('echo', 1),
    itc1.send('with-function', 2),
    itc1.send('plain', 3),
    itc1.send('missing', 4),
    itc1.send('echo', 5)
  ].map((request, i) => {
    return request.then(
      value => settled.push([i, value]),
      error => settled.push([i, error.code])
    )
  })

  await Promise.all(requests)

  // Sanitized as when posted alone: the function is dropped
  deepStrictEqual(settled, [
    [0, 1],
    [1, { value: 2 }],
    [2, { value: 3 }],
    [3, 'PLT_ITC_HANDLER_NOT_FOUND'],
    [4, 5]
  ])

  deepStrictEqual(
    itc2.posted.map(message => message.type),
    ['PLT_ITC_RESPONSE', 'PLT_ITC_RESPONSES']
  )
  deepStrictEqual(
    itc2.posted[1].responses.map(response => response.name),
    ['with-function', 'plain', 'missing', 'echo']
  )
})

test('should post a lone response at once', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)
  let postedBeforeTurnEnd

  itc2.handle('echo', value => {
    // This immediate runs at the end of this turn, before any immediate the ITC arms.
    setImmediate(() => {
      postedBeforeTurnEnd = itc2.posted.length
    })
    return value
  })

  // With a timeout, so that a response that is never posted fails the test instead of hanging it
  deepStrictEqual(await itc1.send('echo', 1, { timeout: 1000 }), 1)
  deepStrictEqual(postedBeforeTurnEnd, 1)
  deepStrictEqual(
    itc2.posted.map(message => message.type),
    ['PLT_ITC_RESPONSE']
  )
})

test('should batch while every turn has responses and post at once again after a turn without', async t => {
  const posted = []
  const port = {
    postMessage (message) {
      posted.push(message.type === 'PLT_ITC_RESPONSES' ? message.responses.map(response => response.data) : message.data)
    }
  }
  const itc = new ITC({ port, name: 'itc' })
  t.after(() => itc.close())

  function respond (data) {
    itc._queueResponse(port, generateResponse({ reqId: String(data), name: 'test' }, null, data), undefined, true)
  }

  // Idle: posted at once. The others of the turn are batched.
  respond(1)
  respond(2)
  respond(3)
  deepStrictEqual(posted, [1])
  await nextImmediate()
  deepStrictEqual(posted, [1, [2, 3]])

  // Still batching in the next turn, and in the one after
  respond(4)
  respond(5)
  deepStrictEqual(posted, [1, [2, 3]])
  await nextImmediate()
  deepStrictEqual(posted, [1, [2, 3], [4, 5]])
  respond(6)
  await nextImmediate()
  deepStrictEqual(posted, [1, [2, 3], [4, 5], 6])

  // A turn without responses: idle again
  await nextImmediate()
  respond(7)
  deepStrictEqual(posted, [1, [2, 3], [4, 5], 6, 7])

  // The batching period started by 7 queues nothing, as when requests come one at a time.
  // The next 8 responses are posted at once without starting a period, even in the same turn.
  await nextImmediate()
  for (let i = 8; i < 16; i++) {
    respond(i)
  }
  deepStrictEqual(posted.slice(4), [7, 8, 9, 10, 11, 12, 13, 14, 15])

  // The next one starts a period again
  respond(16)
  respond(17)
  deepStrictEqual(posted.at(-1), 16)
  await nextImmediate()
  deepStrictEqual(posted.at(-1), 17)
})

test('should transfer the transfer lists of the queued responses', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)
  const buffers = []

  itc2.handle('buffer', (size, context) => {
    const buffer = new ArrayBuffer(size)
    buffers.push(buffer)
    context.transferList = [buffer]
    return buffer
  })

  // The first response is posted at once, the other two together
  const responses = await Promise.all([itc1.send('buffer', 4), itc1.send('buffer', 8), itc1.send('buffer', 16)])

  deepStrictEqual(
    responses.map(buffer => buffer.byteLength),
    [4, 8, 16]
  )
  // Transferred, not copied
  deepStrictEqual(
    buffers.map(buffer => buffer.byteLength),
    [0, 0, 0]
  )
  deepStrictEqual(
    itc2.posted.map(message => message.type),
    ['PLT_ITC_RESPONSE', 'PLT_ITC_RESPONSES']
  )
})

test('should sanitize a queued response of a handler registered with sanitize: false that cannot be cloned', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)

  itc2.handle('plain', value => ({ value }), { sanitize: false })
  itc2.handle('with-function', value => ({ value, fn () {} }), { sanitize: false })

  // With a timeout, so that responses that are never posted fail the test instead of hanging it
  const options = { timeout: 1000 }
  const responses = await Promise.all([
    itc1.send('plain', 1, options),
    itc1.send('with-function', 2, options),
    itc1.send('plain', 3, options)
  ])

  // The first response is posted at once. The batch of the other two can't be cloned, so they are posted one by one,
  // and the one with a function is sanitized.
  deepStrictEqual(responses, [{ value: 1 }, { value: 2 }, { value: 3 }])
  deepStrictEqual(
    itc2.posted.map(message => message.type),
    ['PLT_ITC_RESPONSE', 'PLT_ITC_RESPONSE', 'PLT_ITC_RESPONSE']
  )
})

test('should post the other queued responses when one cannot be cloned', async () => {
  const worker = new Worker(new URL('./fixtures/clone-error.js', import.meta.url))
  const [report] = await once(worker, 'message')
  await worker.terminate()

  // The first response is posted at once, the other two are batched. Only the response that can't be cloned fails,
  // as when posted alone: its request times out and the responding thread gets an unhandled rejection.
  deepStrictEqual(report, {
    results: [1, 'PLT_ITC_REQUEST_TIMEOUT', 3],
    unhandled: ['DataCloneError'],
    posted: ['PLT_ITC_RESPONSE', 'PLT_ITC_RESPONSE']
  })
})

test('should post the queued responses when the ITC closes', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)

  itc2.handle('echo', value => {
    if (value === 1) {
      // This runs at the end of this turn, when the response to 2 is queued, before the ITC posts it.
      setImmediate(() => itc2.close())
    }

    return value
  })

  deepStrictEqual(await Promise.all([itc1.send('echo', 1), itc1.send('echo', 2)]), [1, 2])
})

test('should post the queued responses when the ITC closes after the current request', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)

  itc2.handle('echo', value => value)
  itc2.handle('close', () => {
    itc2.close()
    return 'closing'
  })

  // The first response is posted at once, the second is queued when the ITC closes.
  deepStrictEqual(await Promise.all([itc1.send('echo', 1), itc1.send('close')]), [1, 'closing'])
})

test('should post the queued responses before any other message on the port', async t => {
  const { itc1, itc2 } = setupBatchingPair(t)
  const received = []
  const ping = Promise.withResolvers()

  itc1.handle('ping', () => {
    received.push('ping request')
  })
  itc2.handle('echo', value => {
    if (value === 1) {
      // This runs at the end of this turn, when the response to 2 is queued: it must still be posted first.
      setImmediate(() => ping.resolve(itc2.send('ping')))
    }

    return value
  })

  await Promise.all([
    itc1.send('echo', 1).then(() => received.push('echo 1 response')),
    itc1.send('echo', 2).then(() => received.push('echo 2 response')),
    ping.promise
  ])

  deepStrictEqual(received, ['echo 1 response', 'echo 2 response', 'ping request'])
})
