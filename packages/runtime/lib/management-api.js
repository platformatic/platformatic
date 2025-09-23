import fastifyAccepts from '@fastify/accepts'
import fastifyWebsocket from '@fastify/websocket'
import { createDirectory, safeRemove } from '@platformatic/foundation'
import fastify from 'fastify'
import { platform, tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createWebSocketStream } from 'ws'

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')

export async function managementApiPlugin (app, opts) {
  app.register(fastifyAccepts)

  const runtime = opts.runtime

  app.get('/status', async () => {
    const status = runtime.getRuntimeStatus()
    return { status }
  })

  app.get('/metadata', async () => {
    return runtime.getRuntimeMetadata()
  })

  app.get('/config', async () => {
    return runtime.getRuntimeConfig()
  })

  app.get('/env', async () => {
    return { ...process.env, ...runtime.getRuntimeEnv() }
  })

  app.post('/stop', async () => {
    app.log.debug('stop applications')
    await runtime.close()
  })

  app.post('/restart', async request => {
    const applications = request.query.applications?.split(',') || []
    app.log.debug({ applications }, 'restart applications')
    await runtime.restart(applications)
  })

  app.get('/applications', async () => {
    return runtime.getApplications()
  })

  app.get('/applications/:id', async request => {
    const { id } = request.params
    app.log.debug('get application details', { id })
    return runtime.getApplicationDetails(id)
  })

  app.get('/applications/:id/config', async request => {
    const { id } = request.params
    app.log.debug('get application config', { id })
    return runtime.getApplicationConfig(id)
  })

  app.get('/applications/:id/env', async request => {
    const { id } = request.params
    app.log.debug('get application config', { id })
    return runtime.getApplicationEnv(id)
  })

  app.get('/applications/:id/openapi-schema', async request => {
    const { id } = request.params
    app.log.debug('get openapi-schema', { id })
    return runtime.getApplicationOpenapiSchema(id)
  })

  app.get('/applications/:id/graphql-schema', async request => {
    const { id } = request.params
    app.log.debug('get graphql-schema', { id })
    return runtime.getApplicationGraphqlSchema(id)
  })

  app.post('/applications/:id/start', async request => {
    const { id } = request.params
    app.log.debug('start application', { id })
    await runtime.startApplication(id)
  })

  app.post('/applications/:id/stop', async request => {
    const { id } = request.params
    app.log.debug('stop application', { id })
    await runtime.stopApplication(id)
  })

  app.all('/applications/:id/proxy/*', async (request, reply) => {
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

    const res = await runtime.inject(id, injectParams)

    delete res.headers['content-length']
    delete res.headers['transfer-encoding']

    reply.code(res.statusCode).headers(res.headers).send(res.body)
  })

  app.post('/applications/:id/pprof/start', async (request, reply) => {
    const { id } = request.params
    app.log.debug('start profiling', { id })

    const options = request.body || {}
    await runtime.startApplicationProfiling(id, options)
    reply.code(200).send({})
  })

  app.post('/applications/:id/pprof/stop', async (request, reply) => {
    const { id } = request.params
    app.log.debug('stop profiling', { id })

    const profileData = await runtime.stopApplicationProfiling(id)
    reply.type('application/octet-stream').code(200).send(profileData)
  })

  app.get('/metrics', { logLevel: 'debug' }, async (req, reply) => {
    const accepts = req.accepts()

    if (!accepts.type('text/plain') && accepts.type('application/json')) {
      const { metrics } = await runtime.getMetrics('json')
      return metrics
    }

    reply.type('text/plain')
    const { metrics } = await runtime.getMetrics('text')
    return metrics
  })

  app.get('/metrics/live', { websocket: true }, async socket => {
    const cachedMetrics = runtime.getCachedMetrics()
    if (cachedMetrics.length > 0) {
      const serializedMetrics = cachedMetrics.map(metric => JSON.stringify(metric)).join('\n')
      socket.send(serializedMetrics + '\n')
    }

    const eventHandler = metrics => {
      const serializedMetrics = JSON.stringify(metrics)
      socket.send(serializedMetrics + '\n')
    }

    runtime.on('metrics', eventHandler)

    socket.on('error', () => {
      runtime.off('metrics', eventHandler)
    })

    socket.on('close', () => {
      runtime.off('metrics', eventHandler)
    })
  })

  app.get('/logs/live', { websocket: true }, async (socket, req) => {
    runtime.addLoggerDestination(createWebSocketStream(socket))
  })
}

export async function startManagementApi (runtime) {
  const runtimePID = process.pid

  const runtimePIDDir = join(PLATFORMATIC_TMP_DIR, runtimePID.toString())
  if (platform() !== 'win32') {
    await createDirectory(runtimePIDDir, true)
  }

  let socketPath = null
  if (platform() === 'win32') {
    socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID.toString()
  } else {
    socketPath = join(runtimePIDDir, 'socket')
  }

  const managementApi = fastify()
  managementApi.register(fastifyWebsocket)
  managementApi.register(managementApiPlugin, { runtime, prefix: '/api/v1' })

  managementApi.addHook('onClose', async () => {
    if (platform() !== 'win32') {
      await safeRemove(runtimePIDDir)
    }
  })

  // When the runtime closes, close the management API as well
  runtime.on('closed', managementApi.close.bind(managementApi))

  /*
    If runtime are started multiple times in a short
    period of time (like in tests), there is a chance that the pipe is still in use
    as the manament API server is closed after the runtime is closed (see event handler above).

    Since it's a very rare case, we simply retry couple of times.
  */
  for (let i = 0; i < 5; i++) {
    try {
      await managementApi.listen({ path: socketPath })
      break
    } catch (e) {
      if (i === 5) {
        throw e
      }

      await sleep(100)
    }
  }

  return managementApi
}
