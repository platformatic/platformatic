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
    async function checkReadiness (runtime) {
      const workers = await runtime.getWorkers()

      for (const worker of Object.values(workers)) {
        if (worker.status !== 'started') {
          return false
        }
      }
      return true
    }

    const successStatusCode = opts.readiness?.success?.statusCode ?? DEFAULT_READINESS_SUCCESS_STATUS_CODE
    const successBody = opts.readiness?.success?.body ?? DEFAULT_READINESS_SUCCESS_BODY
    const failStatusCode = opts.readiness?.fail?.statusCode ?? DEFAULT_READINESS_FAIL_STATUS_CODE
    const failBody = opts.readiness?.fail?.body ?? DEFAULT_READINESS_FAIL_BODY

    promServer.route({
      url: opts.readiness?.endpoint ?? DEFAULT_READINESS_ENDPOINT,
      method: 'GET',
      logLevel: 'warn',
      handler: async (req, reply) => {
        reply.type('text/plain')

        const ready = await checkReadiness(runtime)

        if (ready) {
          reply.status(successStatusCode)
          return successBody
        } else {
          reply.status(failStatusCode)
          return failBody
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
