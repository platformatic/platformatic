'use strict'

const fastify = require('fastify')

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

async function checkReadiness (runtime) {
  const workers = await runtime.getWorkers()

  // check if all workers are started
  for (const worker of Object.values(workers)) {
    if (worker.status !== 'started') {
      return { status: false }
    }
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

async function checkLiveness (runtime) {
  const { status: ready, response: readinessResponse } = await checkReadiness(runtime)
  if (!ready) {
    return { status: false, readiness: readinessResponse }
  }
  // TODO test, doc
  // in case of readiness check failure, if custom readiness response is set, we return the readiness check response on health check endpoint

  const checks = await runtime.getCustomHealthChecks()

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

async function startPrometheusServer (runtime, opts) {
  if (opts.enabled === false) {
    return
  }
  const host = opts.hostname ?? DEFAULT_HOSTNAME
  const port = opts.port ?? DEFAULT_PORT
  const metricsEndpoint = opts.endpoint ?? DEFAULT_METRICS_ENDPOINT
  const auth = opts.auth ?? null

  const promServer = fastify({ name: 'Prometheus server' })

  let onRequestHook
  if (auth) {
    const { username, password } = auth

    await promServer.register(require('@fastify/basic-auth'), {
      validate: function (user, pass, req, reply, done) {
        if (username !== user || password !== pass) {
          return reply.code(401).send({ message: 'Unauthorized' })
        }
        return done()
      },
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
      let response = `Hello from Platformatic Prometheus Server!\nThe metrics are available at ${metricsEndpoint}.`

      if (opts.readiness !== false) {
        response += `\nThe readiness endpoint is available at ${readinessEndpoint}.`
      }

      if (opts.liveness !== false) {
        response += `\nThe liveness endpoint is available at ${livenessEndpoint}.`
      }

      return response
    }
  })

  promServer.route({
    url: metricsEndpoint,
    method: 'GET',
    logLevel: 'warn',
    onRequest: onRequestHook,
    handler: async (req, reply) => {
      reply.type('text/plain')
      const { metrics } = await runtime.getMetrics('text')
      return metrics
    },
  })

  if (opts.readiness !== false) {
    const successStatusCode = opts.readiness?.success?.statusCode ?? DEFAULT_READINESS_SUCCESS_STATUS_CODE
    const successBody = opts.readiness?.success?.body ?? DEFAULT_READINESS_SUCCESS_BODY
    const failStatusCode = opts.readiness?.fail?.statusCode ?? DEFAULT_READINESS_FAIL_STATUS_CODE
    const failBody = opts.readiness?.fail?.body ?? DEFAULT_READINESS_FAIL_BODY

    promServer.route({
      url: readinessEndpoint,
      method: 'GET',
      logLevel: 'warn',
      handler: async (req, reply) => {
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
      },
    })
  }

  if (opts.liveness !== false) {
    const successStatusCode = opts.liveness?.success?.statusCode ?? DEFAULT_LIVENESS_SUCCESS_STATUS_CODE
    const successBody = opts.liveness?.success?.body ?? DEFAULT_LIVENESS_SUCCESS_BODY
    const failStatusCode = opts.liveness?.fail?.statusCode ?? DEFAULT_LIVENESS_FAIL_STATUS_CODE
    const failBody = opts.liveness?.fail?.body ?? DEFAULT_LIVENESS_FAIL_BODY

    promServer.route({
      url: livenessEndpoint,
      method: 'GET',
      logLevel: 'warn',
      handler: async (req, reply) => {
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
      },
    })
  }

  await promServer.listen({ port, host })
  return promServer
}

module.exports = {
  startPrometheusServer,
}
