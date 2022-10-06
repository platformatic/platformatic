'use strict'

const fp = require('fastify-plugin')
const metricsPlugin = require('fastify-metrics')
const basicAuth = require('@fastify/basic-auth')
const fastifyAccepts = require('@fastify/accepts')
const Fastify = require('fastify')
const http = require('http')
const { roundNumber } = require('./utils')

// This is a global server to match global
// prometheus. It's an antipattern, so do
// not use it elsewhere.
let server = null
let handler = null

function transformHttpPromMetrics (httpMetrics = []) {
  const requestMetrics = {
    reqMetrics: {},
    totalReqCount: 0
  }

  for (const metric of httpMetrics) {
    const { method, route, status_code: statusCode } = metric.labels
    if (!requestMetrics.reqMetrics[method]) {
      requestMetrics.reqMetrics[method] = {}
    }
    const methodMetrics = requestMetrics.reqMetrics[method]

    if (!methodMetrics[route]) {
      methodMetrics[route] = {
        reqCountPerStatusCode: {},
        totalReqCount: 0
      }
    }
    const routeMetrics = methodMetrics[route]

    if (metric.metricName === 'http_request_summary_seconds_count') {
      routeMetrics.reqCountPerStatusCode[statusCode] = metric.value
      routeMetrics.totalReqCount += metric.value
      requestMetrics.totalReqCount += metric.value
      continue
    }
    if (metric.labels && metric.labels.quantile === 0.5) {
      const medianResponseTimeSec = metric.value
      routeMetrics.medianResponseTime = roundNumber(medianResponseTimeSec * 1000)
      continue
    }
  }

  let failedCount = 0
  for (const methodMetrics of Object.values(requestMetrics.reqMetrics)) {
    for (const routeMetrics of Object.values(methodMetrics)) {
      let reqFailedCount = 0
      for (const statusCode in routeMetrics.reqCountPerStatusCode) {
        if (statusCode.charAt(0) !== '2') {
          reqFailedCount += routeMetrics.reqCountPerStatusCode[statusCode]
        }
      }
      failedCount += reqFailedCount
      routeMetrics.failureRate = roundNumber(reqFailedCount / routeMetrics.totalReqCount, 2)
    }
  }
  requestMetrics.failureRate = roundNumber(failedCount / requestMetrics.totalReqCount || 0, 2)

  return requestMetrics
}

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

  if (server && server.address().port !== port) {
    server.close()
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
    logLevel: 'info',
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

  const dashboardMetricsEndpointOptions = {
    url: '/metrics/dashboard',
    method: 'GET',
    logLevel: 'info',
    handler: async () => {
      const metrics = await app.metrics.client.register.getMetricsAsJSON()
      const httpMetrics = metrics.find((metric) => metric.name === 'http_request_summary_seconds').values
      return transformHttpPromMetrics(httpMetrics)
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
  promServer.route(dashboardMetricsEndpointOptions)

  app.addHook('onClose', async (instance) => {
    await promServer.close()
  })

  await promServer.ready()
})
