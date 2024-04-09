'use strict'

const { tmpdir } = require('node:os')
const { platform } = require('node:os')
const { join } = require('node:path')
const { mkdir, rm } = require('node:fs/promises')
const fastify = require('fastify')
const ws = require('ws')
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

      const runtimesLogsIds = await runtimeApiClient.getLogIds()
      if (returnAllIds) {
        return runtimesLogsIds
      }

      if (runtimesLogsIds.length === 0) {
        return []
      }

      return { indexes: runtimesLogsIds.at(-1).indexes }
    })

    app.get('/logs/all', async (req, reply) => {
      const runtimePID = parseInt(req.query.pid) || process.pid

      const allLogIds = await runtimeApiClient.getLogIds()
      const logsIds = allLogIds.find((logs) => logs.pid === runtimePID)
      const startLogId = logsIds.indexes.at(0)
      const endLogId = logsIds.indexes.at(-1)

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

      const allLogIds = await runtimeApiClient.getLogIds()
      const runtimeLogsIds = allLogIds.find((logs) => logs.pid === runtimePID)
      if (!runtimeLogsIds || !runtimeLogsIds.indexes.includes(logId)) {
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

async function startManagementApi (runtimeApiClient) {
  const runtimePID = process.pid

  let socketPath = null
  if (platform() === 'win32') {
    socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID.toString()
  } else {
    const runtimeSocketsDir = join(PLATFORMATIC_TMP_DIR, 'sockets')
    await mkdir(runtimeSocketsDir, { recursive: true })
    socketPath = join(runtimeSocketsDir, runtimePID.toString())
  }

  try {
    const runtimeTmpDir = runtimeApiClient.getRuntimeTmpDir()
    await rm(runtimeTmpDir, { recursive: true, force: true }).catch()
    await rm(socketPath, { force: true }).catch((err) => {
      if (err.code !== 'ENOENT') {
        throw new errors.FailedToUnlinkManagementApiSocket(err.message)
      }
    })
    await mkdir(runtimeTmpDir, { recursive: true })

    const managementApi = await createManagementApi(runtimeApiClient)

    if (platform() !== 'win32') {
      managementApi.addHook('onClose', async () => {
        await rm(socketPath, { force: true }).catch()
      })
    }

    await managementApi.listen({ path: socketPath })
    return managementApi
  /* c8 ignore next 4 */
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

module.exports = { startManagementApi, createManagementApi }
