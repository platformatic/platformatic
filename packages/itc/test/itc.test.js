'use strict'

const { deepStrictEqual, fail, ifError, throws } = require('node:assert')
const { once } = require('node:events')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { MessageChannel } = require('node:worker_threads')
const { ITC } = require('../index.js')
const { generateItcRequest, generateItcResponse } = require('./helper.js')

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

  await itc1.notify(notificationName, testNotification)
  const [receivedNotification] = await once(itc2, notificationName)
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
