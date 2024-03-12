'use strict'

const { tmpdir, platform } = require('node:os')
const { join } = require('node:path')
const { createReadStream, watch } = require('node:fs')
const { readFile, readdir, mkdir, unlink } = require('node:fs/promises')
const fastify = require('fastify')
const ts = require('tail-file-stream')
const errors = require('./errors')
const platformaticVersion = require('../package.json').version

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')
const runtimeTmpDir = join(PLATFORMATIC_TMP_DIR, process.pid.toString())

async function createManagementApi (configManager, runtimeApiClient, loggingPort) {
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

    app.get('/logs/live', { websocket: true }, async (connection) => {
      const runtimeTmpFiles = await readdir(runtimeTmpDir)
      const runtimeLogFiles = runtimeTmpFiles
        .filter((file) => file.startsWith('logs'))
        .sort()

      if (runtimeLogFiles.length === 0) {
        connection.end()
        return
      }

      const latestFileName = runtimeLogFiles[runtimeLogFiles.length - 1]
      const latestFilePath = join(runtimeTmpDir, latestFileName)
      const latestFileIndex = parseInt(latestFileName.slice('logs.'.length))

      let isFileEnded = false

      const streamLogFile = (filePath) => {
        const fileStream = ts.createReadStream(filePath)
        fileStream.pipe(connection, { end: false })

        fileStream.on('error', (err) => {
          app.log.error(err, 'Error streaming log file')
          connection.end()
        })

        fileStream.on('data', () => {
          isFileEnded = false
        })
        fileStream.on('eof', () => {
          isFileEnded = true
        })

        return fileStream
      }

      let fileIndex = latestFileIndex
      let fileStream = streamLogFile(latestFilePath)
      let nextFileName = 'logs.' + (latestFileIndex + 1)

      watch(runtimeTmpDir, async (event, filename) => {
        if (event === 'rename' && filename === nextFileName) {
          if (isFileEnded) {
            fileStream.end()
          } else {
            fileStream.on('eof', () => fileStream.end())
          }

          const nextFilePath = join(runtimeTmpDir, nextFileName)

          nextFileName = 'logs.' + ++fileIndex
          fileStream = streamLogFile(nextFilePath)
        }
      }).unref()

      connection.on('close', () => fileStream.close())
      connection.on('error', () => fileStream.close())
    })

    app.get('/logs/count', async () => {
      const runtimeTmpFiles = await readdir(runtimeTmpDir)
      const runtimeLogFiles = runtimeTmpFiles
        .filter((file) => file.startsWith('logs'))
        .sort()

      if (runtimeLogFiles.length === 0) {
        return { count: 0 }
      }

      const latestFileName = runtimeLogFiles[runtimeLogFiles.length - 1]
      const latestFileIndex = parseInt(latestFileName.slice('logs.'.length))

      return { count: latestFileIndex }
    })

    app.get('/logs/:id', async (req) => {
      const { id } = req.params
      const filePath = join(runtimeTmpDir, `logs.${id}`)
      return createReadStream(filePath)
    })
  }, { prefix: '/api/v1' })

  return app
}

async function startManagementApi (configManager, runtimeApiClient, loggingPort) {
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
