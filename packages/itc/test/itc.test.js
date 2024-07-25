'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { MessageChannel } = require('node:worker_threads')
const { ITC } = require('../index.js')
const {
  generateItcRequest,
  generateItcResponse,
} = require('./helper.js')

test('should send a request between threads', async (t) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message' }
  const testResponse = { test: 'test-res-message' }

  const requests = []
  itc2.handle(requestName, async (request) => {
    requests.push(request)
    return testResponse
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  assert.deepStrictEqual(response, testResponse)
  assert.deepStrictEqual(requests, [testRequest])
})

test('should throw an error if send req before listen', async (t) => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1 })
  t.after(() => itc.close())

  try {
    await itc.send('test', 'test-request')
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_SEND_BEFORE_LISTEN')
    assert.strictEqual(error.message, 'ITC cannot send requests before listening')
  }
})

test('should throw an error if request name is not a string', async (t) => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1 })
  t.after(() => itc.close())

  itc.listen()

  try {
    await itc.send(true, 'test-request')
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_REQUEST_NAME_IS_NOT_STRING')
    assert.strictEqual(error.message, 'ITC request name is not a string: "true"')
  }
})

test('should throw if call listen twice', async (t) => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1 })
  t.after(() => itc.close())

  itc.listen()

  try {
    itc.listen()
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_ALREADY_LISTENING')
    assert.strictEqual(error.message, 'ITC is already listening')
  }
})

test('should throw an error if handler fails', async (t) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

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
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_HANDLER_FAILED')
    assert.strictEqual(error.message, 'Handler failed with error: test-error')
    assert.strictEqual(error.handlerError.message, 'test-error')
  }
})

test('should throw if handler is not found', async (t) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  const requestName = 'test-command'

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  try {
    await itc1.send(requestName, 'test-request')
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_HANDLER_NOT_FOUND')
    assert.strictEqual(error.message, 'Handler not found for request: "test-command"')
  }
})

test('should skip non-platformatic message', async (t) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  const requests = []
  itc1.handle('test', async (request) => {
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

  assert.deepStrictEqual(requests, ['test-message'])
})

test('should emit unhandledError if request version is wrong', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', (error) => {
    assert.strictEqual(error.code, 'PLT_ITC_INVALID_REQUEST_VERSION')
    assert.strictEqual(error.message, 'Invalid ITC request version: "0.0.0"')
    done()
  })

  const itcRequest = generateItcRequest({ version: '0.0.0' })
  port2.postMessage(itcRequest)
})

test('should emit unhandledError if request reqId is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', (error) => {
    assert.strictEqual(error.code, 'PLT_ITC_MISSING_REQUEST_REQ_ID')
    assert.strictEqual(error.message, 'ITC request reqId is missing')
    done()
  })

  const itcRequest = generateItcRequest()
  delete itcRequest.reqId

  port2.postMessage(itcRequest)
})

test('should emit unhandledError if request name is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', (error) => {
    assert.strictEqual(error.code, 'PLT_ITC_MISSING_REQUEST_NAME')
    assert.strictEqual(error.message, 'ITC request name is missing')
    done()
  })

  const itcRequest = generateItcRequest()
  delete itcRequest.name

  port2.postMessage(itcRequest)
})

test('should emit unhandledError if response version is wrong', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', (error) => {
    assert.strictEqual(error.code, 'PLT_ITC_INVALID_RESPONSE_VERSION')
    assert.strictEqual(error.message, 'Invalid ITC response version: "0.0.0"')
    done()
  })

  const itcResponse = generateItcResponse({ version: '0.0.0' })
  port2.postMessage(itcResponse)
})

test('should emit unhandledError if response reqId is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', (error) => {
    assert.strictEqual(error.code, 'PLT_ITC_MISSING_RESPONSE_REQ_ID')
    assert.strictEqual(error.message, 'ITC response reqId is missing')
    done()
  })

  const itcResponse = generateItcResponse()
  delete itcResponse.reqId

  port2.postMessage(itcResponse)
})

test('should emit unhandledError if response name is missing', (t, done) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  itc1.listen()
  itc2.listen()

  itc2.on('unhandledError', (error) => {
    assert.strictEqual(error.code, 'PLT_ITC_MISSING_RESPONSE_NAME')
    assert.strictEqual(error.message, 'ITC response name is missing')
    done()
  })

  const itcResponse = generateItcResponse()
  delete itcResponse.name

  port2.postMessage(itcResponse)
})

test('should sanitize a request before sending', async (t) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  const requestName = 'test-command'
  const testRequest = {
    test: 'test-req-message',
    foo: () => {},
    bar: Symbol('test'),
    nested: {
      test: 'test-req-message',
      foo: () => {},
      bar: Symbol('test'),
    },
  }
  const testResponse = { test: 'test-res-message' }

  const requests = []
  itc2.handle(requestName, async (request) => {
    requests.push(request)
    return testResponse
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  const response = await itc1.send(requestName, testRequest)
  assert.deepStrictEqual(response, testResponse)
  assert.deepStrictEqual(requests, [{
    test: 'test-req-message',
    nested: { test: 'test-req-message' },
  }])
})

test('should throw if receiver ITC port was closed', async (t) => {
  const { port1, port2 } = new MessageChannel()

  const itc1 = new ITC({ port: port1 })
  const itc2 = new ITC({ port: port2 })

  const requestName = 'test-command'
  const testRequest = { test: 'test-req-message' }

  itc2.handle(requestName, async () => {
    await sleep(10000)
    assert.fail('Handler should not be called')
  })

  itc1.listen()
  itc2.listen()

  t.after(() => itc1.close())
  t.after(() => itc2.close())

  port2.close()

  try {
    await itc1.send(requestName, testRequest)
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_MESSAGE_PORT_CLOSED')
    assert.strictEqual(error.message, 'ITC MessagePort is closed')
  }
})

test('should throw if sender ITC port was closed', async (t) => {
  const { port1 } = new MessageChannel()

  const itc = new ITC({ port: port1 })
  itc.listen()

  port1.close()

  try {
    await itc.send('test-command', 'test-req-message')
    assert.fail('Expected an error to be thrown')
  } catch (error) {
    assert.strictEqual(error.code, 'PLT_ITC_MESSAGE_PORT_CLOSED')
    assert.strictEqual(error.message, 'ITC MessagePort is closed')
  }
})
