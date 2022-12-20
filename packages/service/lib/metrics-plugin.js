'use strict'

const http = require('http')
const { eventLoopUtilization } = require('perf_hooks').performance
const fp = require('fastify-plugin')
const metricsPlugin = require('fastify-metrics')
const basicAuth = require('@fastify/basic-auth')
const fastifyAccepts = require('@fastify/accepts')
const Fastify = require('fastify')

// This is a global server to match global
// prometheus. It's an antipattern, so do
// not use it elsewhere.
let server = null
let handler = null

module.exports = fp(async function (app, opts) {
  let port = 9090
  let host = '0.0.0.0'
  if (typeof opts === 'object') {
    if (undefined !== opts.port) {
      port = opts.port
    }
    /* c8 ignore next 3 */
    if (undefined !== opts.hostname) {
      host = opts.hostname
    }
  }
  app.register(metricsPlugin, {
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

  if (server && server.address().port !== port) {
    await new Promise((resolve) => server.close(resolve))
    server = null
    handler = null
  }

  if (!server) {
    server = http.createServer()
    server.listen(port, host)
    server.unref()
  }

  const promServer = Fastify({
    name: 'Prometheus server',
    serverFactory: (_handler) => {
      if (handler) {
        server.off('request', handler)
      }
      server.on('request', _handler)
      handler = _handler
      return server
    },
    logger: app.log.child({ name: 'prometheus' })
  })

  promServer.register(fastifyAccepts)

  const metricsEndpointOptions = {
    url: '/metrics',
    method: 'GET',
    logLevel: 'trace',
    handler: async (req, reply) => {
      const promRegistry = app.metrics.client.register
      const accepts = req.accepts()
      if (!accepts.type('text/plain') && accepts.type('application/json')) {
        return await promRegistry.getMetricsAsJSON()
      }
      reply.type('text/plain')
      return await promRegistry.metrics()
    }
  }

  if (opts.auth) {
    const { username, password } = opts.auth
    await promServer.register(basicAuth, {
      validate: function (user, pass, req, reply, done) {
        if (username !== user || password !== pass) {
          return reply.code(401).send({ message: 'Unauthorized' })
        }
        return done()
      }
    })
    metricsEndpointOptions.onRequest = promServer.basicAuth
  }
  promServer.route(metricsEndpointOptions)

  app.addHook('onClose', async (instance) => {
    await promServer.close()
  })

  await promServer.ready()
})
