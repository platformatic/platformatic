
import { test } from 'node:test'
import { equal, deepEqual } from 'node:assert'
import WebSocket, { WebSocketServer } from 'ws'
import { setUpEnvironment } from './helper.js'
import updatePlugin from '../plugins/update.js'
import { once, EventEmitter } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

function createMockApp (port) {
  return {
    log: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    },
    instanceConfig: {
      applicationId: 'test-application-id'
    },
    getAuthorizationHeader: async () => {
      return { Authorization: 'Bearer test-token' }
    },
    env: {
      PLT_APP_NAME: 'test-app',
      PLT_APP_DIR: '/path/to/app',
      PLT_ICC_URL: `http://localhost:${port}`,
      PLT_UPDATES_RECONNECT_INTERVAL_SEC: 1
    }
  }
}
const port = 13000

test('update plugin connects to websocket', async (t) => {
  const ee = new EventEmitter()
  setUpEnvironment()

  // Setup WebSocket server
  const wss = new WebSocketServer({ port })
  t.after(async () => wss.close())

  wss.on('connection', (ws, req) => {
    equal(req.headers.authorization, 'Bearer test-token', 'Should authenticate with token')

    // Send a test subscription acknowledgment
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.command === 'subscribe' && message.topic === '/config') {
        ws.send(JSON.stringify({
          command: 'ack'
        }))
        ee.emit('subscriptionAckSent')
      }
    })
  })

  const app = createMockApp(port)
  t.after(() => app.closeUpdates())

  const recordedMessages = {
    info: [],
    warn: [],
    error: []
  }

  app.log.info = (data, msg) => {
    if (msg) {
      recordedMessages.info.push({ data, msg })
    } else {
      recordedMessages.info.push(data)
    }
  }

  await updatePlugin(app)

  const ack = once(ee, 'subscriptionAckSent')
  // don't await on purpose
  app.connectToUpdates()
  await ack

  await sleep(200)

  const subscriptionAckLog = recordedMessages.info.find(
    entry => entry === 'Received subscription acknowledgment from updates websocket'
  )
  equal(!!subscriptionAckLog, true, 'Should log subscription acknowledgment')
})

test('update plugin handles config update messages', async (t) => {
  const ee = new EventEmitter()
  setUpEnvironment()

  const wss = new WebSocketServer({ port })
  t.after(async () => wss.close())

  let clientSocket = null
  wss.on('connection', (ws, req) => {
    clientSocket = ws
    equal(req.headers.authorization, 'Bearer test-token', 'Should authenticate with token')

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.command === 'subscribe' && message.topic === '/config') {
        ws.send(JSON.stringify({
          command: 'ack'
        }))
        ee.emit('subscriptionAckSent')
      }
    })
  })

  const app = createMockApp(port)
  t.after(() => app.closeUpdates())

  const loggedMessages = {
    info: [],
    warn: [],
    error: []
  }

  app.log.info = (data, msg) => {
    if (msg) {
      loggedMessages.info.push({ data, msg })
    } else {
      loggedMessages.info.push(data)
    }
  }

  await updatePlugin(app)

  // Track processed messages
  const processedMessages = []
  app.updateConfig = async (message) => {
    processedMessages.push(message)
    ee.emit('config-updated', message)
  }
  const ack = once(ee, 'subscriptionAckSent')
  // don't await on purpose
  app.connectToUpdates()
  await ack

  await sleep(200)

  const testMessage = {
    topic: '/config',
    type: 'config-updated',
    data: {
      version: '1.0.0',
      settings: {
        feature1: true,
        feature2: false
      }
    }
  }

  clientSocket.send(JSON.stringify(testMessage))

  const configUpdate = once(ee, 'config-updated')
  await configUpdate

  equal(processedMessages.length, 1)

  const updatedMessage = processedMessages[0]
  equal(updatedMessage.topic, '/config', 'Should receive the correct topic')
  equal(updatedMessage.type, 'config-updated', 'Should receive the correct type')
  deepEqual(updatedMessage.data, testMessage.data, 'Should receive the correct data')
})

test('update plugin ignores messages with unknown type', async (t) => {
  const ee = new EventEmitter()
  setUpEnvironment()

  // Setup WebSocket server
  const wss = new WebSocketServer({ port })
  t.after(async () => wss.close())

  let clientSocket = null
  wss.on('connection', (ws, req) => {
    clientSocket = ws
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.command === 'subscribe' && message.topic === '/config') {
        ws.send(JSON.stringify({
          command: 'ack'
        }))
        ee.emit('subscriptionAckSent')
      }
    })
  })

  const app = createMockApp(port)
  t.after(() => app.closeUpdates())

  // Track processed messages
  const processedMessages = []
  app.updateConfig = async (message) => {
    processedMessages.push(message)
    ee.emit('config-updated', message)
  }

  const loggedMessages = {
    info: [],
    warn: [],
    error: []
  }

  app.log.info = (data, msg) => {
    if (msg) {
      loggedMessages.info.push({ data, msg })
    } else {
      loggedMessages.info.push(data)
    }
  }

  await updatePlugin(app)
  await app.connectToUpdates()

  // Send a message with unknown type
  const testMessage = {
    topic: '/config',
    type: 'unknownType',
    data: { test: true }
  }

  clientSocket.send(JSON.stringify(testMessage))
  await sleep(200)

  // The message should be logged but not processed by updateConfig
  equal(processedMessages.length, 0, 'Should not process messages with unknown type')

  const unknownTypeLog = loggedMessages.info.find(log =>
    log.data?.topic === '/config' &&
    log.data?.type === 'unknownType' &&
    log.msg === 'Received message, not handled type'
  )

  equal(!!unknownTypeLog, true, 'Should log when receiving message with unknown type')
})

test('update plugin handles invalid messages', async (t) => {
  const ee = new EventEmitter()
  setUpEnvironment()

  const wss = new WebSocketServer({ port })
  t.after(async () => wss.close())

  let clientSocket = null
  wss.on('connection', (ws, req) => {
    clientSocket = ws

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.command === 'subscribe' && message.topic === '/config') {
        ws.send(JSON.stringify({
          command: 'ack'
        }))
        ee.emit('subscriptionAckSent')
      }
    })
  })

  const app = createMockApp(port)
  t.after(() => app.closeUpdates())

  const loggedMessages = {
    info: [],
    warn: [],
    error: []
  }

  app.log.warn = (data, msg) => {
    if (msg) {
      loggedMessages.warn.push({ data, msg })
    } else {
      loggedMessages.warn.push(data)
    }
  }

  await updatePlugin(app)
  await app.connectToUpdates()

  // Send an invalid message (missing topic)
  const invalidMessage = {
    type: 'configUpdate',
    data: { test: true }
  }

  clientSocket.send(JSON.stringify(invalidMessage))

  await sleep(100)

  const invalidMsgLog = loggedMessages.warn.find(log =>
    log.msg === 'Received invalid message from updates websocket'
  )

  equal(!!invalidMsgLog, true, 'Should log warning when receiving invalid message')
})

test('update plugin handles connection errors', async (t) => {
  setUpEnvironment()

  const app = createMockApp(9999) // Non-existent port
  t.after(() => app.closeUpdates())

  const loggedErrors = []
  app.log.error = (err, msg) => {
    loggedErrors.push({ err, msg })
  }

  await updatePlugin(app)
  await app.connectToUpdates()

  equal(loggedErrors.length >= 1, true, 'Error should be logged')
  equal(loggedErrors[0].msg, 'Failed to connect and subscribe to updates websocket', 'Should log connection error')
})

test('update plugin closeUpdates method closes the connection', async (t) => {
  const ee = new EventEmitter()
  setUpEnvironment()

  const closedConnections = []

  const wss = new WebSocketServer({ port })
  t.after(async () => wss.close())

  wss.on('connection', (ws) => {
    ws.on('close', () => {
      closedConnections.push(ws)
      ee.emit('connectionClosed')
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      if (message.command === 'subscribe' && message.topic === '/config') {
        ws.send(JSON.stringify({
          command: 'ack'
        }))
        ee.emit('subscriptionAckSent')
      }
    })
  })

  const app = createMockApp(port)

  await updatePlugin(app)
  await app.connectToUpdates()

  await app.closeUpdates()

  const closeEvent = once(ee, 'connectionClosed')
  await Promise.race([closeEvent, sleep(1000)])

  equal(closedConnections.length, 1, 'WebSocket connection should be closed')
})

test('update plugin handles missing PLT_ICC_URL', async (t) => {
  setUpEnvironment()

  const app = createMockApp(port)
  // Remove PLT_ICC_URL to test missing URL scenario
  delete app.env.PLT_ICC_URL

  const loggedMessages = {
    warn: []
  }

  app.log.warn = (msg) => {
    loggedMessages.warn.push(msg)
  }

  await updatePlugin(app)
  const result = await app.connectToUpdates()

  equal(result, null, 'Should return null when PLT_ICC_URL is missing')
  equal(loggedMessages.warn.length, 1, 'Should log a warning')
  equal(loggedMessages.warn[0], 'No PLT_ICC_URL found in environment, cannot connect to updates websocket')
})

test('update plugin handles missing applicationId', async (t) => {
  setUpEnvironment()

  const app = createMockApp(port)
  // Remove applicationId to test missing ID scenario
  delete app.instanceConfig.applicationId

  const loggedMessages = {
    warn: []
  }

  app.log.warn = (msg) => {
    loggedMessages.warn.push(msg)
  }

  await updatePlugin(app)
  const result = await app.connectToUpdates()

  equal(result, null, 'Should return null when applicationId is missing')
  equal(loggedMessages.warn.length, 1, 'Should log a warning')
  equal(loggedMessages.warn[0], 'No application ID found, cannot connect to updates websocket')
})

test('should reconnect to updates if connection closes', async (t) => {
  function startWebSocketServer () {
    // Setup WebSocket server
    const wss = new WebSocketServer({ port })

    wss.connections = []
    wss.on('connection', ws => {
      wss.connections.push(ws)
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (
          message.command === 'subscribe' &&
          message.topic === '/config'
        ) {
          ws.send(JSON.stringify({ command: 'ack' }))
        }
      })
    })

    wss.broadcast = (data) => {
      wss.connections.forEach(ws => { ws.send(data) })
    }

    return wss
  }

  const wss1 = startWebSocketServer()

  const app = createMockApp(port)
  t.after(() => app.closeUpdates())
  await updatePlugin(app)

  const processedMessages = []
  app.updateConfig = async (message) => {
    processedMessages.push(message)
  }

  await app.connectToUpdates()

  const testMessage1 = {
    topic: '/config',
    type: 'config-updated',
    data: { foo: 'bar' }
  }

  wss1.broadcast(JSON.stringify(testMessage1))
  await sleep(200)

  deepEqual(processedMessages, [testMessage1])

  wss1.close()
  for (const ws of wss1.connections) {
    ws.terminate()
  }

  const wss2 = startWebSocketServer()
  await sleep(2000)

  const testMessage2 = {
    topic: '/config',
    type: 'config-updated',
    data: { foo: 'baz' }
  }

  wss2.broadcast(JSON.stringify(testMessage2))
  await sleep(200)

  deepEqual(processedMessages, [testMessage1, testMessage2])
  wss2.close()
})
