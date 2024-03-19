'use strict'

const { tmpdir, platform } = require('node:os')
const { join } = require('node:path')
const { readFile, mkdir, unlink } = require('node:fs/promises')
const fastify = require('fastify')
const ws = require('ws')
const errors = require('./errors')
const { pipeLiveLogs, getLogFileStream, getLogIndexes } = require('./logs')
const platformaticVersion = require('../package.json').version

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, process.pid.toString())

async function createManagementApi (configManager, runtimeApiClient) {
  const app = fastify()
  app.log.warn(
    'Runtime Management API is in the experimental stage. ' +
    'The feature is not subject to semantic versioning rules. ' +
    'Non-backward compatible changes or removal may occur in any future release. ' +
    'Use of the feature is not recommended in production environments.'
  )

  async function getRuntimePackageJson (cwd) {
    const packageJsonPath = join(cwd, 'package.json')
    const packageJsonFile = await readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonFile)
    return packageJson
  }

  app.register(require('@fastify/websocket'))

  app.register(async (app) => {
    app.get('/metadata', async () => {
      const packageJson = await getRuntimePackageJson(configManager.dirname).catch(() => ({}))
      const entrypointDetails = await runtimeApiClient.getEntrypointDetails().catch(() => null)

      return {
        pid: process.pid,
        cwd: process.cwd(),
        argv: process.argv,
        uptimeSeconds: Math.floor(process.uptime()),
        execPath: process.execPath,
        nodeVersion: process.version,
        projectDir: configManager.dirname,
        packageName: packageJson.name ?? null,
        packageVersion: packageJson.version ?? null,
        url: entrypointDetails?.url ?? null,
        platformaticVersion
      }
    })

    app.get('/config', async () => {
      return configManager.current
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
      const serializedMetrics = cachedMetrics
        .map((metric) => JSON.stringify(metric))
        .join('\n')
      socket.send(serializedMetrics)

      const eventHandler = (metrics) => {
        const serializedMetrics = JSON.stringify(metrics)
        socket.send(serializedMetrics)
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
      const startLogIndex = req.query.start ? parseInt(req.query.start) : null

      if (startLogIndex) {
        const logIndexes = await getLogIndexes()
        if (!logIndexes.includes(startLogIndex)) {
          throw new errors.LogFileNotFound(startLogIndex)
        }
      }

      const stream = ws.createWebSocketStream(socket)

      pipeLiveLogs(stream, req.log, startLogIndex)
    })

    app.get('/logs/indexes', async () => {
      const logIndexes = await getLogIndexes()
      return { indexes: logIndexes }
    })

    app.get('/logs/:id', async (req) => {
      const { id } = req.params

      const logIndex = parseInt(id)
      const logIndexes = await getLogIndexes()
      if (!logIndexes.includes(logIndex)) {
        throw new errors.LogFileNotFound(logIndex)
      }

      const logFileStream = await getLogFileStream(logIndex)
      return logFileStream
    })
  }, { prefix: '/api/v1' })

  return app
}

async function startManagementApi (configManager, runtimeApiClient) {
  const runtimePID = process.pid

  let socketPath = null
  if (platform() === 'win32') {
    socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID
  } else {
    socketPath = join(runtimeTmpDir, 'socket')
  }

  try {
    await mkdir(runtimeTmpDir, { recursive: true })
    await unlink(socketPath).catch((err) => {
      if (err.code !== 'ENOENT') {
        throw new errors.FailedToUnlinkManagementApiSocket(err.message)
      }
    })

    const managementApi = await createManagementApi(
      configManager,
      runtimeApiClient
    )

    if (platform() !== 'win32') {
      managementApi.addHook('onClose', async () => {
        await unlink(socketPath).catch(() => {})
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
