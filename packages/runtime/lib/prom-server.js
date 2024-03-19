'use strict'

const fastify = require('fastify')

async function startPrometheusServer (runtimeApiClient, opts) {
  const host = opts.hostname ?? '0.0.0.0'
  const port = opts.port ?? 9090
  const metricsEndpoint = opts.endpoint ?? '/metrics'
  const auth = opts.auth ?? null

  const promServer = fastify({ name: 'Prometheus server' })

  runtimeApiClient.on('close', async () => {
    await promServer.close()
  })

  let onRequestHook
  if (auth) {
    const { username, password } = auth

    await promServer.register(require('@fastify/basic-auth'), {
      validate: function (user, pass, req, reply, done) {
        if (username !== user || password !== pass) {
          return reply.code(401).send({ message: 'Unauthorized' })
        }
        return done()
      }
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
      const { metrics } = await runtimeApiClient.getMetrics('text')
      return metrics
    }
  })

  await promServer.listen({ port, host })
  return promServer
}

module.exports = {
  startPrometheusServer
}
