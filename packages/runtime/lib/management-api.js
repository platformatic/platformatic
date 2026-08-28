import fastifyAccepts from '@fastify/accepts'
import fastifyWebsocket from '@fastify/websocket'
import {
  applications as applicationSchema,
  createDirectory,
  createSharedTemporaryDirectory,
  kMetadata,
  safeRemove,
  validate
} from '@platformatic/foundation'
import fastify from 'fastify'
import { chmod } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createWebSocketStream } from 'ws'
import { prepareAddedApplications } from './config.js'

const PLATFORMATIC_TMP_DIR = join(tmpdir(), 'platformatic', 'runtimes')

const loggerLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace']

/*
  Endpoints which are frequently polled by clients (the CLI, the dashboard or any other
  monitoring tool) do not log the request/response pair to avoid flooding the runtime logs.
*/
const quiet = { logLevel: 'warn' }

/*
  The management API is closed after the runtime has been closed (see the "closed" event handler
  in startManagementApi), so that the POST /stop endpoint can reply. By then the runtime logger
  has been destroyed and writing to its destination throws.

  To avoid that, the logger is never captured: it is resolved - and its children are recreated -
  on each call, so that logging becomes a no-op as soon as the runtime replaces its logger with
  the abstract one.
*/
function createRuntimeLoggerProxy (getParent, bindings, options) {
  let parent
  let logger

  function resolve () {
    const current = getParent()

    if (current !== parent) {
      parent = current
      logger = bindings ? parent.child(bindings, options) : parent
    }

    return logger
  }

  const proxy = {
    child (childBindings, childOptions) {
      return createRuntimeLoggerProxy(resolve, childBindings, childOptions)
    }
  }

  for (const level of loggerLevels) {
    proxy[level] = function (...args) {
      return resolve()[level](...args)
    }
  }

  return proxy
}

export async function managementApiPlugin (app, opts) {
  app.register(fastifyAccepts)

  const runtime = opts.runtime

  async function deleteApplications (ids, reply) {
    const validIds = runtime.getApplicationsIds()

    for (const id of ids) {
      if (!validIds.includes(id)) {
        reply.code(404)

        return {
          error: 'Not Found',
          message: `Application with id "${id}" not found.`,
          statusCode: 404
        }
      }
    }

    const removed = await runtime.removeApplications(ids)
    reply.code(202)
    return removed
  }

  app.get('/status', quiet, async () => {
    const status = runtime.getRuntimeStatus()
    return { status }
  })

  app.get('/metadata', quiet, async () => {
    return runtime.getRuntimeMetadata()
  })

  app.get('/env', quiet, async () => {
    return { ...process.env, ...runtime.getRuntimeEnv() }
  })

  app.post('/stop', async () => {
    app.log.debug('stop applications')
    await runtime.close()
  })

  app.post('/restart', async request => {
    const applications = request.body?.applications ?? []
    app.log.debug({ applications }, 'restart applications')
    await runtime.restart(applications)
  })

  app.get('/scheduler', async () => {
    const jobs = await runtime.getSchedulerJobs()
    return { jobs }
  })

  app.post('/scheduler/:name/pause', async request => {
    return runtime.pauseSchedulerJob(request.params.name)
  })

  app.post('/scheduler/:name/resume', async request => {
    return runtime.resumeSchedulerJob(request.params.name)
  })

  app.post('/scheduler/:name/run', async request => {
    return runtime.runSchedulerJob(request.params.name)
  })

  app.get('/applications', quiet, async () => {
    return runtime.getApplications()
  })

  app.post('/applications', async (request, reply) => {
    let applications = request.body

    if (!Array.isArray(applications)) {
      applications = [applications]
    }

    const config = runtime.getRuntimeConfig(true)

    try {
      validate(applicationSchema, applications, {}, true, config[kMetadata].root)
    } catch (err) {
      reply.code(400)

      return {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid applications configuration.',
        validationErrors: err.validationErrors
      }
    }

    const prepared = await prepareAddedApplications(config, applications, runtime.getApplicationsIds())

    const created = await runtime.addApplications(prepared, request.query.start !== 'false')
    reply.code(201)
    return created
  })

  app.delete('/applications', async (request, reply) => {
    if (!Array.isArray(request.body)) {
      reply.code(404)
      return {
        statusCode: 404,
        error: 'Bad Request',
        message: 'Invalid applications IDs.'
      }
    }

    return deleteApplications(request.body, reply)
  })

  app.get('/applications/:id', quiet, async request => {
    const { id } = request.params
    app.log.debug({ id }, 'get application details')
    return runtime.getApplicationDetails(id)
  })

  app.delete('/applications/:id', async (request, reply) => {
    return deleteApplications([request.params.id], reply)
  })

  app.get('/applications/:id/config', quiet, async request => {
    const { id } = request.params
    app.log.debug({ id }, 'get application config')
    return runtime.getApplicationConfig(id)
  })

  app.get('/applications/:id/env', quiet, async request => {
    const { id } = request.params
    app.log.debug({ id }, 'get application env')
    return runtime.getApplicationEnv(id)
  })

  app.get('/applications/:id/openapi-schema', quiet, async request => {
    const { id } = request.params
    app.log.debug({ id }, 'get openapi-schema')
    return runtime.getApplicationOpenapiSchema(id)
  })

  app.get('/applications/:id/graphql-schema', quiet, async request => {
    const { id } = request.params
    app.log.debug({ id }, 'get graphql-schema')
    return runtime.getApplicationGraphqlSchema(id)
  })

  app.post('/applications/:id/start', async request => {
    const { id } = request.params
    app.log.debug({ id }, 'start application')
    await runtime.startApplication(id)
  })

  app.post('/applications/:id/stop', async request => {
    const { id } = request.params
    app.log.debug({ id }, 'stop application')
    await runtime.stopApplication(id)
  })

  app.all('/applications/:id/proxy/*', quiet, async (request, reply) => {
    const { id, '*': requestUrl } = request.params
    app.log.debug({ id, requestUrl }, 'proxy request')

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
    app.log.debug({ id }, 'start profiling')

    const options = request.body || {}
    const result = await runtime.startApplicationProfiling(id, options)
    reply.code(200).send(result ?? {})
  })

  app.post('/applications/:id/pprof/stop', async (request, reply) => {
    const { id } = request.params
    app.log.debug({ id }, 'stop profiling')

    const options = request.body || {}
    const profileData = await runtime.stopApplicationProfiling(id, options)

    // With allWorkers there is one profile per worker: return them as JSON
    // with base64 encoded payloads since a single binary body cannot carry
    // multiple profiles.
    if (options.allWorkers && Array.isArray(profileData)) {
      const profiles = profileData.map(({ workerIndex, profile }) => ({
        workerIndex,
        profile: Buffer.from(profile).toString('base64')
      }))

      return { profiles }
    }

    reply.type('application/octet-stream').code(200).send(profileData)
  })

  app.post('/applications/:id/heap-snapshot', async (request, reply) => {
    const { id } = request.params
    app.log.debug({ id }, 'take heap snapshot')

    const stream = await runtime.takeApplicationHeapSnapshot(id)
    reply.type('application/octet-stream').send(stream)
    return reply
  })

  app.get('/metrics', quiet, async (req, reply) => {
    // The live read: this needs one boolean, and the public getter builds a frozen snapshot of the
    // whole configuration -- which is the right shape to hand a consumer and the wrong one to pay
    // for on a scrape.
    const config = runtime.getRuntimeConfig(true)

    if (config.metrics?.enabled === false) {
      reply.code(501)
      return {
        statusCode: 501,
        error: 'Not Implemented',
        message: 'Metrics are disabled.'
      }
    }

    const accepts = req.accepts()

    if (!accepts.type('text/plain') && accepts.type('application/json')) {
      const { metrics } = await runtime.getMetrics('json')
      return metrics
    }

    reply.type('text/plain')
    const { metrics } = await runtime.getMetrics('text')
    return metrics
  })

  // TODO: Remove in next major version - deprecated endpoint
  app.get('/metrics/live', { ...quiet, websocket: true }, async socket => {
    // The live read: this needs one boolean, and the public getter builds a frozen snapshot of the
    // whole configuration -- which is the right shape to hand a consumer and the wrong one to pay
    // for on a scrape.
    const config = runtime.getRuntimeConfig(true)

    if (config.metrics?.enabled === false) {
      socket.send(
        JSON.stringify({
          statusCode: 501,
          error: 'Not Implemented',
          message: 'Metrics are disabled.'
        }),
        () => {
          socket.close()
        }
      )

      return
    }

    const pollAndSendMetrics = async () => {
      try {
        const metrics = await runtime.getFormattedMetrics()
        if (metrics) {
          const serializedMetrics = JSON.stringify(metrics)
          socket.send(serializedMetrics + '\n')
        }
      } catch (error) {
        // If there's an error, stop polling and close the connection
        clearInterval(pollingInterval)
        socket.close()
      }
    }

    // Poll every second
    const pollingInterval = setInterval(pollAndSendMetrics, 1000)

    // Send initial metrics immediately
    await pollAndSendMetrics()

    const cleanup = () => {
      clearInterval(pollingInterval)
    }

    socket.on('error', cleanup)
    socket.on('close', cleanup)
  })

  app.get('/logs/live', { ...quiet, websocket: true }, async socket => {
    runtime.addLoggerDestination(createWebSocketStream(socket))
  })

  app.get('/applications/:id/repl', { websocket: true }, async (socket, request) => {
    const { id } = request.params

    try {
      // Start REPL and get the communication port
      const port = await runtime.startApplicationRepl(id)

      // Forward messages between WebSocket and MessagePort
      port.on('message', (message) => {
        if (message.type === 'output') {
          socket.send(message.data)
        } else if (message.type === 'exit') {
          socket.close()
        }
      })

      socket.on('message', (data) => {
        port.postMessage({ type: 'input', data: data.toString() })
      })

      socket.on('close', () => {
        port.postMessage({ type: 'close' })
        port.close()
      })

      socket.on('error', () => {
        port.postMessage({ type: 'close' })
        port.close()
      })
    } catch (error) {
      socket.send(JSON.stringify({
        error: error.message,
        code: error.code
      }))
      socket.close()
    }
  })
}

export async function startManagementApi (runtime, config) {
  const runtimePID = process.pid
  const customSocket = typeof config === 'object' ? config?.socket : null

  const runtimePIDDir = join(PLATFORMATIC_TMP_DIR, runtimePID.toString())
  if (platform() !== 'win32') {
    if (customSocket) {
      await createDirectory(dirname(customSocket))
    } else {
      await createSharedTemporaryDirectory('platformatic', 'runtimes')
      await createDirectory(runtimePIDDir, true)
      // The socket must only be accessible by the current user
      await chmod(runtimePIDDir, 0o700)
    }
  }

  let socketPath = null
  if (customSocket) {
    socketPath = customSocket
  } else if (platform() === 'win32') {
    socketPath = '\\\\.\\pipe\\platformatic-' + runtimePID.toString()
  } else {
    socketPath = join(runtimePIDDir, 'socket')
  }

  const managementApi = fastify({
    loggerInstance: createRuntimeLoggerProxy(() => runtime.logger, { name: 'management-api' })
  })

  managementApi.register(fastifyWebsocket)
  managementApi.register(managementApiPlugin, { runtime, prefix: '/api/v1' })

  managementApi.addHook('onClose', async () => {
    if (platform() !== 'win32' && !customSocket) {
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
      // Fastify always logs listen() at info. The management API binds a private unix
      // socket/pipe, so that message is noise and also breaks helpers that treat the first
      // "listening at" log as the application URL. Downgrade it to debug for this call.
      const { log } = managementApi
      const originalInfo = log.info
      log.info = function (...args) {
        const text = typeof args[0] === 'string' ? args[0] : args[1]
        if (typeof text === 'string' && text.startsWith('Server listening at')) {
          return log.debug(...args)
        }

        return originalInfo.apply(this, args)
      }

      try {
        await managementApi.listen({ path: socketPath })
      } finally {
        log.info = originalInfo
      }

      break
    } catch (e) {
      if (i === 4) {
        throw e
      }

      await sleep(100)
    }
  }

  return managementApi
}
