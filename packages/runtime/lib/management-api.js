'use strict'

const { tmpdir, platform } = require('node:os')
const { join } = require('node:path')
const { readFile, mkdir, unlink } = require('node:fs/promises')
const fastify = require('fastify')
const { prettyFactory } = require('pino-pretty')
const errors = require('./errors')
const platformaticVersion = require('../package.json').version

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'pids')

const pinoLogLevels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10
}

async function createManagementApi (configManager, runtimeApiClient, loggingPort) {
  let apiConfig = configManager.current.managementApi
  if (!apiConfig || apiConfig === true) {
    apiConfig = {}
  }

  const app = fastify(apiConfig)
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
        uptimeSeconds: Math.floor(process.uptime()),
        execPath: process.execPath,
        nodeVersion: process.version,
        projectDir: configManager.dirname,
        packageName: packageJson.name ?? null,
        packageVersion: packageJson.version ?? null,
        url: entrypointDetails?.url ?? null,
        status: entrypointDetails?.status ?? null,
        platformaticVersion
      }
    })

    app.get('/env', async () => {
      return process.env
    })

    app.get('/services', async () => {
      return runtimeApiClient.getServices()
    })

    app.post('/services/stop', async () => {
      app.log.debug('stop services')
      await runtimeApiClient.close()
    })

    app.post('/services/restart', async () => {
      app.log.debug('restart services')
      await runtimeApiClient.restart()
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

    app.get('/logs', { websocket: true }, async (connection, req) => {
      const logLevel = req.query.level || 'info'
      const pretty = req.query.pretty !== 'false'
      const serviceId = req.query.serviceId || null

      const logLevelNumber = pinoLogLevels[logLevel]
      const prettify = prettyFactory()

      const handler = (message) => {
        for (let log of message.logs) {
          try {
            const parsedLog = JSON.parse(log)
            if (parsedLog.level < logLevelNumber) continue
            if (serviceId && parsedLog.name !== serviceId) continue
            if (pretty) {
              log = prettify(parsedLog)
            }
            connection.socket.send(log)
          } catch (err) {
            console.error('Failed to parse log message: ', log, err)
          }
        }
      }

      loggingPort.on('message', handler)
      connection.socket.on('close', () => {
        loggingPort.off('message', handler)
      })
      connection.socket.on('error', () => {
        loggingPort.off('message', handler)
      })
      connection.socket.on('end', () => {
        loggingPort.off('message', handler)
      })
    })
  }, { prefix: '/api' })

  return app
}

async function startManagementApi (configManager, runtimeApiClient, loggingPort) {
  const runtimePID = process.pid

  let socketPath = null
  if (platform() === 'win32') {
    socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID
  } else {
    await mkdir(PLATFORMATIC_TMP_DIR, { recursive: true })
    socketPath = join(PLATFORMATIC_TMP_DIR, `${runtimePID}.sock`)
  }

  try {
    await mkdir(PLATFORMATIC_TMP_DIR, { recursive: true })
    await unlink(socketPath).catch((err) => {
      if (err.code !== 'ENOENT') {
        throw new errors.FailedToUnlinkManagementApiSocket(err.message)
      }
    })

    const managementApi = await createManagementApi(
      configManager,
      runtimeApiClient,
      loggingPort
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
