import fastifyAccepts from '@fastify/accepts'
import fastifyBasicAuth from '@fastify/basic-auth'
import { loadModule, sanitizeHTTPSOptions } from '@platformatic/foundation'
import fastify from 'fastify'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { DuplicateExtensionHealthRouteError } from './errors.js'

const DEFAULT_HOSTNAME = '0.0.0.0'
const DEFAULT_PORT = 9090
const DEFAULT_METRICS_ENDPOINT = '/metrics'
const DEFAULT_READINESS_ENDPOINT = '/ready'
const DEFAULT_READINESS_SUCCESS_STATUS_CODE = 200
const DEFAULT_READINESS_SUCCESS_BODY = 'OK'
const DEFAULT_READINESS_FAIL_STATUS_CODE = 500
const DEFAULT_READINESS_FAIL_BODY = 'ERR'
const DEFAULT_LIVENESS_ENDPOINT = '/status'
const DEFAULT_LIVENESS_SUCCESS_STATUS_CODE = 200
const DEFAULT_LIVENESS_SUCCESS_BODY = 'OK'
const DEFAULT_LIVENESS_FAIL_STATUS_CODE = 500
const DEFAULT_LIVENESS_FAIL_BODY = 'ERR'

async function checkWorkerReadiness (runtime) {
  const workers = await runtime.getWorkers()
  const applications = await runtime.getApplicationsIds()

  // Make sure there is at least one started worker
  const started = new Set()
  for (const worker of Object.values(workers)) {
    if (worker.status === 'started') {
      started.add(worker.application)
    }
  }

  if (started.size !== applications.length) {
    return { status: false }
  }

  // perform custom readiness checks, get custom response content if any
  const checks = await runtime.getCustomReadinessChecks()

  let response
  const status = Object.values(checks).every(check => {
    if (typeof check === 'boolean') {
      return check
    } else if (typeof check === 'object') {
      response = check
      return check.status
    }
    return false
  })

  return { response, status }
}

async function checkReadiness (runtime) {
  const workerResult = await checkWorkerReadiness(runtime)
  if (!workerResult.status) {
    return workerResult
  }

  // Extension readiness checks participate in /ready only.
  const extensionResult = await runtime.runExtensionReadinessChecks()
  if (!extensionResult.status) {
    return {
      status: false,
      response: extensionResult.response ?? workerResult.response
    }
  }

  return {
    status: true,
    response: extensionResult.response ?? workerResult.response
  }
}

async function checkLiveness (runtime) {
  // Worker readiness still gates liveness (existing semantics), but extension
  // readiness-only failures must not fail /status and cause restart loops.
  const workerReadiness = await checkWorkerReadiness(runtime)
  if (!workerReadiness.status) {
    return { status: false, readiness: workerReadiness.response }
  }

  const checks = await runtime.getCustomHealthChecks()

  let response
  const workerStatus = Object.values(checks).every(check => {
    if (typeof check === 'boolean') {
      return check
    } else if (typeof check === 'object') {
      response = check
      return check.status || false
    }
    return false
  })

  if (!workerStatus) {
    return { response, status: false }
  }

  const extensionResult = await runtime.runExtensionLivenessChecks()
  if (!extensionResult.status) {
    return {
      status: false,
      response: extensionResult.response ?? response
    }
  }

  return {
    status: true,
    response: extensionResult.response ?? response
  }
}

function isHealthProbesServerEnabled (healthProbes) {
  return typeof healthProbes === 'object' && healthProbes !== null
}

function isHealthProbesEnabled (healthProbes) {
  return healthProbes !== false && healthProbes?.enabled !== false
}

function resolveServerAddress (opts, fallback) {
  opts = typeof opts === 'object' && opts !== null ? opts : {}
  fallback = typeof fallback === 'object' && fallback !== null ? fallback : {}

  return {
    host: opts.hostname ?? fallback.hostname ?? DEFAULT_HOSTNAME,
    port: opts.port ?? fallback.port ?? DEFAULT_PORT
  }
}

function useSharedServer (metricsOpts, healthProbes) {
  if (!isHealthProbesServerEnabled(healthProbes)) {
    return true
  }

  const metricsAddress = resolveServerAddress(metricsOpts)
  const healthProbesAddress = resolveServerAddress(healthProbes, metricsOpts)

  return metricsAddress.host === healthProbesAddress.host && String(metricsAddress.port) === String(healthProbesAddress.port)
}

function resolveHealthProbesOptions (metricsOpts, healthProbes) {
  metricsOpts = typeof metricsOpts === 'object' && metricsOpts !== null ? metricsOpts : {}

  if (!isHealthProbesServerEnabled(healthProbes)) {
    return metricsOpts
  }

  const { host, port } = resolveServerAddress(healthProbes, metricsOpts)
  return {
    ...healthProbes,
    hostname: host,
    port,
    readiness: healthProbes.readiness ?? metricsOpts.readiness,
    liveness: healthProbes.liveness ?? metricsOpts.liveness
  }
}

async function registerExtensionHealthRoutes (promServer, runtime) {
  const routes = runtime.getExtensionHealthRoutes?.() ?? []

  for (const entry of routes) {
    if (!entry.active) {
      continue
    }

    try {
      await promServer.register(async function extensionHealthRoutes (app) {
        app.addHook('onRequest', async (_req, reply) => {
          if (!entry.active) {
            return reply.code(404).send({ message: 'Not Found' })
          }
        })

        await app.register(entry.plugin)
      })
      entry.applied = true
    } catch (err) {
      const routeMatch = typeof err.message === 'string'
        ? err.message.match(/Method '([^']+)' already declared for route '([^']+)'/i)
        : null
      const method = routeMatch?.[1] ?? 'UNKNOWN'
      const url = routeMatch?.[2] ?? 'unknown'

      throw new DuplicateExtensionHealthRouteError(entry.extensionPath, method, url, err.message, { cause: err })
    }
  }
}

async function startServer (runtime, opts, metricsEnabled, healthProbesEnabled) {
  opts = typeof opts === 'object' && opts !== null ? opts : {}

  if (!metricsEnabled && !healthProbesEnabled) {
    return
  }

  const host = opts.hostname ?? DEFAULT_HOSTNAME
  const port = opts.port ?? DEFAULT_PORT
  const metricsEndpoint = opts.endpoint ?? DEFAULT_METRICS_ENDPOINT
  const auth = opts.auth ?? null
  const https = await sanitizeHTTPSOptions(opts.https)

  const promServer = fastify({ name: 'Prometheus server', loggerInstance: runtime.logger, https })
  promServer.register(fastifyAccepts)

  let onRequestHook
  if (auth) {
    const { username, password } = auth

    await promServer.register(fastifyBasicAuth, {
      validate: function (user, pass, req, reply, done) {
        if (username !== user || password !== pass) {
          return reply.code(401).send({ message: 'Unauthorized' })
        }
        return done()
      }
    })
    onRequestHook = promServer.basicAuth
  }

  const readinessEndpoint = opts.readiness?.endpoint ?? DEFAULT_READINESS_ENDPOINT
  const livenessEndpoint = opts.liveness?.endpoint ?? DEFAULT_LIVENESS_ENDPOINT

  promServer.route({
    url: '/',
    method: 'GET',
    logLevel: 'warn',
    handler (req, reply) {
      reply.type('text/plain')
      let response = 'Hello from Platformatic Prometheus Server!'

      if (metricsEnabled) {
        response += `\nThe metrics are available at ${metricsEndpoint}.`
      }

      if (healthProbesEnabled && opts.readiness !== false) {
        response += `\nThe readiness endpoint is available at ${readinessEndpoint}.`
      }

      if (healthProbesEnabled && opts.liveness !== false) {
        response += `\nThe liveness endpoint is available at ${livenessEndpoint}.`
      }

      return response
    }
  })

  if (metricsEnabled) {
    promServer.route({
      url: metricsEndpoint,
      method: 'GET',
      logLevel: 'warn',
      onRequest: onRequestHook,
      handler: async (req, reply) => {
        const accepts = req.accepts()
        const reqType = !accepts.type('text/plain') && accepts.type('application/json') ? 'json' : 'text'
        if (reqType === 'text') {
          reply.type('text/plain')
        }
        return (await runtime.getMetrics(reqType)).metrics
      }
    })
  }

  if (healthProbesEnabled && opts.readiness !== false) {
    const successStatusCode = opts.readiness?.success?.statusCode ?? DEFAULT_READINESS_SUCCESS_STATUS_CODE
    const successBody = opts.readiness?.success?.body ?? DEFAULT_READINESS_SUCCESS_BODY
    const failStatusCode = opts.readiness?.fail?.statusCode ?? DEFAULT_READINESS_FAIL_STATUS_CODE
    const failBody = opts.readiness?.fail?.body ?? DEFAULT_READINESS_FAIL_BODY

    promServer.route({
      url: readinessEndpoint,
      method: 'GET',
      logLevel: 'warn',
      handler: async (_req, reply) => {
        reply.type('text/plain')

        const { status, response } = await checkReadiness(runtime)

        if (typeof response === 'boolean') {
          if (status) {
            reply.status(successStatusCode).send(successBody)
          } else {
            reply.status(failStatusCode).send(failBody)
          }
        } else if (typeof response === 'object') {
          const { status, body, statusCode } = response
          if (status) {
            reply.status(statusCode || successStatusCode).send(body || successBody)
          } else {
            reply.status(statusCode || failStatusCode).send(body || failBody)
          }
        } else if (!response) {
          if (status) {
            reply.status(successStatusCode).send(successBody)
          } else {
            reply.status(failStatusCode).send(failBody)
          }
        }
      }
    })
  }

  if (healthProbesEnabled && opts.liveness !== false) {
    const successStatusCode = opts.liveness?.success?.statusCode ?? DEFAULT_LIVENESS_SUCCESS_STATUS_CODE
    const successBody = opts.liveness?.success?.body ?? DEFAULT_LIVENESS_SUCCESS_BODY
    const failStatusCode = opts.liveness?.fail?.statusCode ?? DEFAULT_LIVENESS_FAIL_STATUS_CODE
    const failBody = opts.liveness?.fail?.body ?? DEFAULT_LIVENESS_FAIL_BODY

    promServer.route({
      url: livenessEndpoint,
      method: 'GET',
      logLevel: 'warn',
      handler: async (_req, reply) => {
        reply.type('text/plain')

        const { status, response, readiness } = await checkLiveness(runtime)

        if (typeof response === 'boolean') {
          if (status) {
            reply.status(successStatusCode).send(successBody)
          } else {
            reply.status(failStatusCode).send(readiness?.body || failBody)
          }
        } else if (typeof response === 'object') {
          const { status, body, statusCode } = response
          if (status) {
            reply.status(statusCode || successStatusCode).send(body || successBody)
          } else {
            reply.status(statusCode || failStatusCode).send(body || readiness?.body || failBody)
          }
        } else if (!response) {
          if (status) {
            reply.status(successStatusCode).send(successBody)
          } else {
            reply.status(failStatusCode).send(readiness?.body || failBody)
          }
        }
      }
    })
  }

  const require = createRequire(resolve(import.meta.filename))
  for (const pluginPath of opts.plugins ?? []) {
    const plugin = await loadModule(require, pluginPath)
    await promServer.register(plugin)
  }

  // Extension routes must be registered before the server starts listening.
  if (healthProbesEnabled) {
    await registerExtensionHealthRoutes(promServer, runtime)
  }

  await promServer.listen({ port, host })
  return promServer
}

export async function startPrometheusServer (runtime, opts, healthProbes) {
  const metricsEnabled = opts !== false && opts?.enabled !== false
  const healthProbesEnabled = isHealthProbesEnabled(healthProbes) && useSharedServer(opts, healthProbes)
  const serverOpts = healthProbesEnabled && isHealthProbesServerEnabled(healthProbes) ? resolveHealthProbesOptions(opts, healthProbes) : opts

  return startServer(runtime, serverOpts, metricsEnabled, healthProbesEnabled)
}

export async function startHealthProbesServer (runtime, metricsOpts, healthProbes) {
  if (!isHealthProbesEnabled(healthProbes) || useSharedServer(metricsOpts, healthProbes)) {
    return
  }

  return startServer(runtime, resolveHealthProbesOptions(metricsOpts, healthProbes), false, true)
}
