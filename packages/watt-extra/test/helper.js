import { Agent, setGlobalDispatcher } from 'undici'
import { mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import fastify from 'fastify'
import fp from 'fastify-plugin'
import why from 'why-is-node-running'
import fastifyWebsocket from '@fastify/websocket'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

setInterval(why, 120000).unref()

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10
}))

function setUpEnvironment (env = {}) {
  const defaultEnv = {
    PLT_ZIO_HOSTNAME: '127.0.0.1',
    PLT_ZIO_PORT: 4042,
    PLT_ZIO_LOG_LEVEL: 'debug',
    PLT_APP_HOSTNAME: '127.0.0.1',
    PLT_APP_PORT: 3042,
    PLT_METRICS_PORT: 9090,
    PLT_DISABLE_COMPLIANCE_CHECK: 'true',
    PLT_DISABLE_FLAMEGRAPHS: 'true',
    PLT_THROW_ON_COMPLIANCE_FAILURE: 'false',
    PLT_TEST_TOKEN: createJwtToken(3600)
  }
  Object.assign(process.env, defaultEnv, env)
}

async function startICC (t, opts = {}) {
  let {
    applicationId,
    applicationName,
    iccServices,
    iccConfig = {},
    enableOpenTelemetry = false,
    enableSlicerInterceptor = false,
    enableTrafficanteInterceptor = false,
    controlPlaneResponse
  } = opts

  iccServices = iccServices || {
    riskEngine: {
      url: 'http://127.0.0.1:3000/risk-service'
    },
    trafficante: {
      url: 'http://127.0.0.1:3000/trafficante'
    },
    compliance: {
      url: 'http://127.0.0.1:3000/compliance'
    },
    cron: {
      url: 'http://127.0.0.1:3000/cron'
    },
    scaler: {
      url: 'http://127.0.0.1:3000/scaler'
    }
  }

  const icc = fastify({
    keepAliveTimeout: 1,
    forceCloseConnections: true
  })

  await icc.register(fastifyWebsocket)

  // Main
  await icc.register(fp(async (icc) => {
    const connections = new Map()

    icc.decorate('emitApplicationUpdate', (applicationId, config) => {
      const appConnections = connections.get(applicationId)
      if (appConnections) {
        for (const connection of appConnections) {
          connection.send(JSON.stringify(config))
        }
      }
    })

    icc.get('/api/updates/applications/:id', { websocket: true }, async (connection, req) => {
      connection.on('message', (message) => {
        const applicationId = req.params.id
        const { command, topic } = JSON.parse(message.toString())

        if (command === 'subscribe' && topic === '/config') {
          connection.send(JSON.stringify({ command: 'ack' }))
        }

        let appConnections = connections.get(applicationId)
        if (!appConnections) {
          appConnections = []
          connections.set(applicationId, appConnections)
        }
        appConnections.push(connection)
      })
    })
  }))

  // Control Plane
  await icc.register(async (icc) => {
    icc.post('/pods/:podId/instance', async (req) => {
      if (typeof controlPlaneResponse === 'function') {
        return controlPlaneResponse(req)
      }
      return controlPlaneResponse || {
        applicationId,
        applicationName,
        iccServices,
        config: iccConfig,
        enableOpenTelemetry,
        enableSlicerInterceptor,
        enableTrafficanteInterceptor
      }
    })

    icc.post('/applications/:id/metadata', async (req) => {
      const { applicationId, data } = req.body
      return opts.saveComplianceMetadata?.(applicationId, data)
    })

    icc.post('/pods/:id/instance/state', async (req) => {
      const instanceId = req.params.id
      const state = req.body

      await opts.saveApplicationInstanceState?.({ instanceId, state })
      return {}
    })
  }, { prefix: '/control-plane' })

  // Compliance
  await icc.register(async (icc) => {
    icc.post('/metadata', async (req) => {
      const { applicationId, data } = req.body
      return opts.saveComplianceMetadata?.(applicationId, data)
    })

    icc.post('/compliance', async (req) => {
      const { applicationId } = req.body
      return opts.getComplianceReport?.(applicationId)
    })
  }, { prefix: '/compliance' })

  // Trafficante
  await icc.register(async (icc) => {
    icc.post('/requests/hash', async (req) => {
      const { taxonomyId, applicationId } = JSON.parse(req.headers['x-trafficante-labels'])
      const { timestamp, request, response } = req.body
      opts.saveRequestHash?.({ taxonomyId, applicationId, timestamp, request, response })
    })

    icc.post('/requests', async (req) => {
      const { taxonomyId, applicationId } = JSON.parse(req.headers['x-trafficante-labels'])
      const request = JSON.parse(req.headers['x-request-data'])
      const response = JSON.parse(req.headers['x-response-data'])
      response.body = req.body

      opts.saveRequest?.({ taxonomyId, applicationId, request, response })
    })
  }, { prefix: '/trafficante' })

  // Risk Service
  await icc.register(async (icc) => {
    icc.addContentTypeParser(
      'application/x-protobuf',
      (req, payload, done) => {
        payload.resume()
        payload.on('end', done)
      }
    )
    icc.post('/v1/traces', async () => {})
  }, { prefix: '/risk-service' })

  // Scaler
  await icc.register(async (icc) => {
    icc.addContentTypeParser(
      'application/octet-stream',
      function (request, payload, done) {
        const chunks = []
        payload.on('data', chunk => chunks.push(chunk))
        payload.on('end', () => {
          done(null, Buffer.concat(chunks))
        })
        payload.on('error', done)
      }
    )
    icc.post('/alerts', async (req) => {
      return opts.processAlerts?.(req)
    })
    icc.post('/pods/:podId/services/:serviceId/flamegraph', async (req) => {
      return opts.processFlamegraphs?.(req)
    })
  }, { prefix: '/scaler' })

  // Cron
  await icc.register(async (icc) => {
    icc.put('/watt-jobs', async (req) => {
      const body = req.body
      opts.saveWattJob?.(body)
    })
  }, { prefix: '/cron' })

  await icc.listen({ port: 3000 })
  return icc
}

async function installDeps (t, appDir, packageNames, testDependencies = []) {
  const appDepsDir = join(appDir, 'node_modules')
  await rm(appDepsDir, { force: true, recursive: true }).catch(() => {})
  await mkdir(appDepsDir, { recursive: true })
  t.after(() => rm(appDepsDir, { force: true, recursive: true }))

  const toInstall = Array.from(new Set([
    ...packageNames ?? [],
    '@platformatic/runtime',
    '@platformatic/config',
    '@platformatic/service',
    '@platformatic/node',
    'undici'
  ]))

  for (const packageName of toInstall) {
    let targetDir = null
    let packageDir = null

    if (packageName.includes('/')) {
      const [scope, name] = packageName.split('/')
      await mkdir(join(appDepsDir, scope), { recursive: true })

      targetDir = join(__dirname, '..', 'node_modules', scope, name)
      packageDir = join(appDepsDir, scope, name)
    } else {
      packageDir = join(appDepsDir, packageName)
      targetDir = join(__dirname, '..', 'node_modules', packageName)
    }
    await symlink(targetDir, packageDir)
  }

  for (const testDependency of testDependencies) {
    const { name, version } = testDependency
    const packageDir = join(appDepsDir, name)
    await mkdir(packageDir, { recursive: true })

    const packageJsonPath = join(packageDir, 'package.json')
    const packageJsonFile = JSON.stringify({ name, version })
    await writeFile(packageJsonPath, packageJsonFile)
  }
}

function createJwtToken (expiresInSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const currentTime = Math.floor(Date.now() / 1000)
  const payload = {
    sub: '1234567890',
    iat: currentTime,
    exp: currentTime + (expiresInSeconds || 3600) // Default 1 hour expiration
  }
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '')
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '')
  const signature = 'test_signature'
  return `${base64Header}.${base64Payload}.${signature}`
}

export {
  setUpEnvironment,
  startICC,
  installDeps,
  createJwtToken
}
