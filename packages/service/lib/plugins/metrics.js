'use strict'

const http = require('http')
const { eventLoopUtilization } = require('perf_hooks').performance
const fp = require('fastify-plugin')
const metricsPlugin = require('fastify-metrics')
const basicAuth = require('@fastify/basic-auth')
const fastifyAccepts = require('@fastify/accepts')
const Fastify = require('fastify')

// This is a global httpServer to match global
// prometheus. It's an antipattern, so do
// not use it elsewhere.
let httpServer = null

module.exports = fp(async function (app, opts) {
  const server = opts.server ?? 'own'
  const hostname = opts.hostname ?? '0.0.0.0'
  const port = opts.port ?? 9090
  const metricsEndpoint = opts.endpoint ?? '/metrics'
  const auth = opts.auth ?? null

  let basicAuthValidator = null
  if (auth) {
    const { username, password } = auth
    basicAuthValidator = function (user, pass, req, reply, done) {
      if (username !== user || password !== pass) {
        return reply.code(401).send({ message: 'Unauthorized' })
      }
      return done()
    }

    if (server === 'parent') {
      await app.register(basicAuth, {
        validate: basicAuthValidator
      })

      app.addHook('onRoute', (routeOptions) => {
        if (routeOptions.url === metricsEndpoint) {
          routeOptions.onRequest = app.basicAuth
        }
      })
    }
  }

  app.register(metricsPlugin, {
    defaultMetrics: { enabled: true },
    endpoint: server === 'parent' ? metricsEndpoint : null,
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

  if (httpServer && httpServer.address().port !== port) {
    await new Promise((resolve) => httpServer.close(resolve))
    httpServer = null
  }

  if (server === 'parent') {
    return
  }

  if (!httpServer) {
    httpServer = http.createServer()
    httpServer.listen(port, hostname)
    httpServer.unref()
  }

  const promServer = Fastify({
    name: 'Prometheus server',
    serverFactory: (handler) => {
      httpServer.removeAllListeners('request')
      httpServer.removeAllListeners('clientError')
      httpServer.on('request', handler)
      return httpServer
    },
    logger: app.log.child({ name: 'prometheus' })
  })

  promServer.register(fastifyAccepts)

  const metricsEndpointOptions = {
    url: metricsEndpoint,
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

  if (auth) {
    await promServer.register(basicAuth, {
      validate: basicAuthValidator
    })
    metricsEndpointOptions.onRequest = promServer.basicAuth
  }
  promServer.route(metricsEndpointOptions)

  app.addHook('onClose', async (instance) => {
    await promServer.close()
  })

  await promServer.ready()
})
