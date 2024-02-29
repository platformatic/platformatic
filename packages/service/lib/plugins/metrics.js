'use strict'

const http = require('node:http')
const { eventLoopUtilization } = require('node:perf_hooks').performance
const fastify = require('fastify')
const fp = require('fastify-plugin')

const metricsPlugin = fp(async function (app) {
  app.register(require('fastify-metrics'), {
    defaultMetrics: { enabled: true },
    endpoint: null,
    name: 'metrics',
    routeMetrics: { enabled: true },
    clearRegisterOnInit: true
  })

  app.register(async (app) => {
    const eluMetric = new app.metrics.client.Summary({
      name: 'nodejs_eventloop_utilization',
      help: 'The event loop utilization as a fraction of the loop time. 1 is fully utilized, 0 is fully idle.',
      maxAgeSeconds: 60,
      ageBuckets: 5,
      labelNames: ['idle', 'active', 'utilization']
    })

    let startELU = eventLoopUtilization()
    const eluTimeout = setInterval(() => {
      const endELU = eventLoopUtilization()
      eluMetric.observe(eventLoopUtilization(endELU, startELU).utilization)
      startELU = endELU
    }, 100)

    app.addHook('onClose', () => {
      clearInterval(eluTimeout)
    })

    app.metrics.client.register.registerMetric(eluMetric)
  })
}, {
  encapsulate: false
})

// This is a global httpServer to match global
// prometheus. It's an antipattern, so do
// not use it elsewhere.
let httpServer = null

async function createMetricsServer (app, hostname, port) {
  if (httpServer && httpServer.address().port !== port) {
    await closeMetricsServer()
  }

  if (!httpServer) {
    httpServer = http.createServer()
    httpServer.listen(port, hostname)
    httpServer.unref()
  }

  const promServer = fastify({
    name: 'Prometheus server',
    serverFactory: (handler) => {
      httpServer.removeAllListeners('request')
      httpServer.removeAllListeners('clientError')
      httpServer.on('request', handler)
      return httpServer
    },
    logger: app.log.child({ name: 'prometheus' })
  })

  app.addHook('onClose', async () => {
    await promServer.close()
  })

  return promServer
}

async function closeMetricsServer () {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve))
    httpServer = null
  }
}

module.exports = fp(async function (app, opts) {
  const server = opts.server ?? 'own'
  const hostname = opts.hostname ?? '0.0.0.0'
  const port = opts.port ?? 9090
  const metricsEndpoint = opts.endpoint ?? '/metrics'
  const auth = opts.auth ?? null

  app.register(metricsPlugin)

  let metricsServer = app
  if (server === 'own') {
    metricsServer = await createMetricsServer(app, hostname, port)
  } else {
    await closeMetricsServer()
  }

  let onRequestHook
  if (auth) {
    const { username, password } = auth

    await metricsServer.register(require('@fastify/basic-auth'), {
      validate: function (user, pass, req, reply, done) {
        if (username !== user || password !== pass) {
          return reply.code(401).send({ message: 'Unauthorized' })
        }
        return done()
      }
    })
    onRequestHook = metricsServer.basicAuth
  }

  metricsServer.register(require('@fastify/accepts'))
  metricsServer.route({
    url: metricsEndpoint,
    method: 'GET',
    logLevel: 'warn',
    onRequest: onRequestHook,
    handler: async (req, reply) => {
      const promRegistry = app.metrics.client.register
      const accepts = req.accepts()
      if (!accepts.type('text/plain') && accepts.type('application/json')) {
        return promRegistry.getMetricsAsJSON()
      }
      reply.type('text/plain')
      return promRegistry.metrics()
    }
  })

  if (server === 'own') {
    await metricsServer.ready()
  }
})
