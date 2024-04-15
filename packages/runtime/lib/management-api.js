'use strict'

const { tmpdir } = require('node:os')
const { platform } = require('node:os')
const { join } = require('node:path')
const { mkdir, rm } = require('node:fs/promises')
const fastify = require('fastify')
const ws = require('ws')
const { getRuntimeLogsDir } = require('./api-client.js')
const errors = require('./errors')

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')

async function createManagementApi (runtimeApiClient) {
  const app = fastify()
  app.log.warn(
    'Runtime Management API is in the experimental stage. ' +
    'The feature is not subject to semantic versioning rules. ' +
    'Non-backward compatible changes or removal may occur in any future release. ' +
    'Use of the feature is not recommended in production environments.'
  )

  app.register(require('@fastify/websocket'))

  app.register(async (app) => {
    app.get('/metadata', async () => {
      return runtimeApiClient.getRuntimeMetadata()
    })

    app.get('/config', async () => {
      return runtimeApiClient.getRuntimeConfig()
    })

    app.get('/env', async () => {
      return process.env
    })

    app.post('/stop', async () => {
      app.log.debug('stop services')
      await runtimeApiClient.close()
    })

    app.post('/reload', async () => {
      app.log.debug('reload services')
      await runtimeApiClient.restart()
    })

    app.get('/services', async () => {
      return runtimeApiClient.getServices()
    })

    app.get('/services/:id', async (request) => {
      const { id } = request.params
      app.log.debug('get service details', { id })
      return runtimeApiClient.getServiceDetails(id)
    })

    app.get('/services/:id/config', async (request) => {
      const { id } = request.params
      app.log.debug('get service config', { id })
      return runtimeApiClient.getServiceConfig(id)
    })

    app.post('/services/:id/start', async (request) => {
      const { id } = request.params
      app.log.debug('start service', { id })
      await runtimeApiClient.startService(id)
    })

    app.post('/services/:id/stop', async (request) => {
      const { id } = request.params
      app.log.debug('stop service', { id })
      await runtimeApiClient.stopService(id)
    })

    app.all('/services/:id/proxy/*', async (request, reply) => {
      const { id, '*': requestUrl } = request.params
      app.log.debug('proxy request', { id, requestUrl })

      delete request.headers.connection
      delete request.headers['content-length']
      delete request.headers['content-encoding']
      delete request.headers['transfer-encoding']

      const injectParams = {
        method: request.method,
        url: requestUrl || '/',
        headers: request.headers,
        query: request.query,
        body: request.body
      }

      const res = await runtimeApiClient.inject(id, injectParams)

      reply
        .code(res.statusCode)
        .headers(res.headers)
        .send(res.body)
    })

    app.get('/metrics/live', { websocket: true }, async (socket) => {
      const cachedMetrics = runtimeApiClient.getCachedMetrics()
      if (cachedMetrics.length > 0) {
        const serializedMetrics = cachedMetrics
          .map((metric) => JSON.stringify(metric))
          .join('\n')
        socket.send(serializedMetrics + '\n')
      }

      const eventHandler = (metrics) => {
        const serializedMetrics = JSON.stringify(metrics)
        socket.send(serializedMetrics + '\n')
      }

      runtimeApiClient.on('metrics', eventHandler)

      socket.on('error', () => {
        runtimeApiClient.off('metrics', eventHandler)
      })

      socket.on('close', () => {
        runtimeApiClient.off('metrics', eventHandler)
      })
    })

    app.get('/logs/live', { websocket: true }, async (socket, req) => {
      const startLogId = req.query.start ? parseInt(req.query.start) : null

      if (startLogId) {
        const logIds = await runtimeApiClient.getLogIds()
        if (!logIds.includes(startLogId)) {
          throw new errors.LogFileNotFound(startLogId)
        }
      }

      const stream = ws.createWebSocketStream(socket)
      runtimeApiClient.pipeLogsStream(stream, req.log, startLogId)
    })

    app.get('/logs/indexes', async (req) => {
      const returnAllIds = req.query.all === 'true'

      if (returnAllIds) {
        const runtimesLogsIds = await runtimeApiClient.getAllLogIds()
        return runtimesLogsIds
      }

      const runtimeLogsIds = await runtimeApiClient.getLogIds()
      return { indexes: runtimeLogsIds }
    })

    app.get('/logs/all', async (req, reply) => {
      const runtimePID = parseInt(req.query.pid) || process.pid

      const logsIds = await runtimeApiClient.getLogIds(runtimePID)
      const startLogId = logsIds.at(0)
      const endLogId = logsIds.at(-1)

      reply.hijack()

      runtimeApiClient.pipeLogsStream(
        reply.raw,
        req.log,
        startLogId,
        endLogId,
        runtimePID
      )
    })

    app.get('/logs/:id', async (req) => {
      const logId = parseInt(req.params.id)
      const runtimePID = parseInt(req.query.pid) || process.pid

      const logIds = await runtimeApiClient.getLogIds(runtimePID)
      if (!logIds || !logIds.includes(logId)) {
        throw new errors.LogFileNotFound(logId)
      }

      const logFileStream = await runtimeApiClient.getLogFileStream(
        logId,
        runtimePID
      )
      return logFileStream
    })
  }, { prefix: '/api/v1' })

  return app
}

async function startManagementApi (runtimeApiClient, configManager) {
  const runtimePID = process.pid

  try {
    const runtimePIDDir = join(PLATFORMATIC_TMP_DIR, runtimePID.toString())
    if (platform() !== 'win32') {
      await rm(runtimePIDDir, { recursive: true, force: true }).catch()
      await mkdir(runtimePIDDir, { recursive: true })
    }

    const runtimeLogsDir = getRuntimeLogsDir(configManager.dirname, process.pid)
    await rm(runtimeLogsDir, { recursive: true, force: true }).catch()
    await mkdir(runtimeLogsDir, { recursive: true })

    let socketPath = null
    if (platform() === 'win32') {
      socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID.toString()
    } else {
      socketPath = join(runtimePIDDir, 'socket')
    }

    const managementApi = await createManagementApi(runtimeApiClient)

    managementApi.addHook('onClose', async () => {
      if (platform() !== 'win32') {
        await rm(runtimePIDDir, { recursive: true, force: true }).catch()
      }
    })

    await managementApi.listen({ path: socketPath })
    return managementApi
  /* c8 ignore next 4 */
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

module.exports = { startManagementApi, createManagementApi }
