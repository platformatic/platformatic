'use strict'

const fastifyStatic = require('@fastify/static')
const path = require('path')

function roundNumber (value, precision = 0) {
  const multiplier = Math.pow(10, precision || 0)
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier
}

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

module.exports = async function app (app, opts) {
  app.log.info('dashboard plugin loaded.')
  if (opts.dashboardAtRoot !== false) {
    app.get('/', { hide: true }, function (req, reply) {
      return reply.redirect(302, '/dashboard')
    })
  }

  app.register(fastifyStatic, {
    root: path.join(__dirname, 'build')
  })

  app.get('/dashboard', { hide: true }, function (req, reply) {
    return reply.sendFile('index.html')
  })

  app.get('/dashboard/metrics', { hide: true }, async function (req, reply) {
    if (app.metrics === undefined) {
      reply.status = 404
      reply.send({ error: 'Metrics plugin is not enabled' })
      return
    }

    const metrics = await app.metrics.client.register.getMetricsAsJSON()
    const httpMetrics = metrics.find((metric) => metric.name === 'http_request_summary_seconds').values
    return transformHttpPromMetrics(httpMetrics)
  })
}
