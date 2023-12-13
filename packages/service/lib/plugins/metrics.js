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

module.exports = fp(async function (app, opts) {
  let port = 9090
  let host = '0.0.0.0'
  let useOwnServer = true
  if (typeof opts === 'object') {
    if (opts.server === 'parent') {
      useOwnServer = false
    } else {
      if (undefined !== opts.port) {
        port = opts.port
      }
      /* c8 ignore next 3 */
      if (undefined !== opts.hostname) {
        host = opts.hostname
      }
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

  if (useOwnServer && server && server.address().port !== port) {
    await new Promise((resolve) => server.close(resolve))
    server = null
  }

  if (useOwnServer && !server) {
    server = http.createServer()
    server.listen(port, host)
    server.unref()
  }

  const promServer = useOwnServer
    ? Fastify({
      name: 'Prometheus server',
      serverFactory: (handler) => {
        server.removeAllListeners('request')
        server.removeAllListeners('clientError')
        server.on('request', handler)
        return server
      },
      logger: app.log.child({ name: 'prometheus' })
    })
    : app

  promServer.register(fastifyAccepts)

  const metricsEndpointOptions = {
    url: '/metrics',
    method: 'GET',
    logLevel: 'warn',
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
        if (req.url.startsWith('/metrics') && (username !== user || password !== pass)) {
          return reply.code(401).send({ message: 'Unauthorized' })
        }
        return done()
      }
    })
    metricsEndpointOptions.onRequest = promServer.basicAuth
  }
  promServer.route(metricsEndpointOptions)

  if (useOwnServer) {
    app.addHook('onClose', async (instance) => {
      await promServer.close()
    })

    await promServer.ready()
  }
})
