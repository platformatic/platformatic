import WebSocket from 'ws'
import { once } from 'node:events'
import { setTimeout as sleep } from 'node:timers/promises'

function createWebSocketUrl (httpUrl, path) {
  const url = new URL(httpUrl)
  url.protocol = url.protocol.replace('http', 'ws')
  const basePath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  url.pathname = `${basePath}${path}`
  return url.toString()
}

async function updatePlugin (app) {
  const reconnectInterval = app.env.PLT_UPDATES_RECONNECT_INTERVAL_SEC * 1000

  let socket = null

  async function processMessage (data) {
    try {
      const message = JSON.parse(data)
      const { topic, type, command } = message

      // Handle trigger-flamegraph command from ICC
      if (command === 'trigger-flamegraph') {
        app.log.info({ command }, 'Received trigger-flamegraph command from ICC')
        await app.triggerFlamegraphs(message)
        return
      }

      // Handle updates websocket format: { type: '...', topic: '...', data: {...} }
      if (!topic || !type) {
        app.log.warn({ message }, 'Received invalid message from updates websocket')
        return
      }

      if (type === 'config-updated') {
        app.log.info({ topic, type }, 'Received config update from updates websocket')
        await app.updateConfig(message)
      } else {
        app.log.info({ topic, type }, 'Received message, not handled type')
      }
    } catch (err) {
      app.log.error(err, 'Error processing message from updates websocket')
    }
  }

  async function connectToUpdates () {
    const applicationId = app.instanceConfig?.applicationId
    if (!applicationId) {
      app.log.warn('No application ID found, cannot connect to updates websocket')
      return null
    }

    const iccUrl = app.env.PLT_ICC_URL
    if (!iccUrl) {
      app.log.warn('No PLT_ICC_URL found in environment, cannot connect to updates websocket')
      return null
    }

    const wsUrl = createWebSocketUrl(iccUrl, `api/updates/applications/${applicationId}`)
    app.log.info(`Connecting to updates websocket at ${wsUrl}`)

    try {
      const headers = await app.getAuthorizationHeader()

      socket = new WebSocket(wsUrl, { headers })
      await once(socket, 'open')

      app.log.info('Connected to updates websocket')
      // Subscribing, if subscription fails we throw, so the caller can retry
      const subscribeMsg = JSON.stringify({ command: 'subscribe', topic: '/config' })
      socket.send(subscribeMsg)

      const command = await once(socket, 'message')
      const message = JSON.parse(command[0])
      if (message?.command !== 'ack') {
        app.log.error({ message }, 'Subscription updates failed')
        throw new Error('Subscription updates failed')
      }
      app.log.info('Received subscription acknowledgment from updates websocket')

      // listen for subsequent messages
      socket.on('message', processMessage)

      socket.on('error', (err) => {
        app.log.error(err, 'Error in updates websocket connection')
        reconnectToUpdates()
      })

      socket.on('close', (code, reason) => {
        app.log.info({ code, reason: reason.toString() }, 'Updates websocket connection closed')
        reconnectToUpdates()
      })
    } catch (err) {
      app.log.error(err, 'Failed to connect and subscribe to updates websocket')
      reconnectToUpdates()
    }
  }

  let isReconnecting = false
  let isClosing = false

  async function reconnectToUpdates () {
    if (isReconnecting || isClosing) return
    isReconnecting = true

    await sleep(reconnectInterval)

    isReconnecting = false
    app.log.info('Reconnecting to updates websocket')
    await connectToUpdates()
  }

  app.updateConfig = async (message) => {
    await app.wattpro.applyIccConfigUpdates(message.data)
  }

  app.triggerFlamegraphs = async (message) => {
    try {
      app.log.info('Triggering flamegraph collection and upload from all services')

      const runtime = app.wattpro.runtime
      if (!runtime) {
        app.log.error('Runtime not available for flamegraph collection')
        return
      }

      const scalerUrl = app.instanceConfig?.iccServices?.scaler?.url
      if (!scalerUrl) {
        app.log.warn('No scaler URL found in ICC services, cannot upload flamegraphs')
        return
      }

      const config = runtime.getRuntimeConfig()
      const authHeaders = await app.getAuthorizationHeader()
      const podId = app.instanceId

      if (!podId) {
        app.log.warn('No podId available, cannot upload flamegraphs')
        return
      }

      // Trigger flamegraphs upload from all services in parallel
      const uploadPromises = (config.services || []).map(async (service) => {
        try {
          await runtime.sendCommandToApplication(service.id, 'sendFlamegraph', {
            url: `${scalerUrl}/pods/${podId}/services/${service.id}/flamegraph`,
            headers: authHeaders
          })
          app.log.debug({ serviceId: service.id, podId }, 'Trigger flamegraph upload from service')
          return { serviceId: service.id, status: 'fulfilled' }
        } catch (err) {
          app.log.warn({ err, serviceId: service.id, podId }, 'Failed to upload flamegraph from service')
          return { serviceId: service.id, status: 'rejected', reason: err }
        }
      })

      await Promise.allSettled(uploadPromises)

      app.log.info('Completed flamegraph collection and upload for all services')
    } catch (err) {
      app.log.error({ err }, 'Error handling watt-requests')
    }
  }

  app.connectToUpdates = connectToUpdates
  app.closeUpdates = async () => {
    isClosing = true
    if (socket) {
      socket.close()
      socket = null
    }
  }
}

export default updatePlugin
