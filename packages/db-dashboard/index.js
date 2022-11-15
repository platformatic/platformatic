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

  const quantileSummary = {}
  let quantileCounter = 0

  for (const metric of httpMetrics) {
    const { method, route, status_code: statusCode } = metric.labels
    if (!requestMetrics.reqMetrics[method]) {
      requestMetrics.reqMetrics[method] = {}
    }
    const methodMetrics = requestMetrics.reqMetrics[method]

    if (!methodMetrics[route]) {
      methodMetrics[route] = {
        reqCountPerStatusCode: {},
        reqTime: {},
        totalReqCount: 0
      }
    }
    const routeMetrics = methodMetrics[route]

    if (metric.metricName === 'http_request_summary_seconds_count') {
      routeMetrics.reqCountPerStatusCode[statusCode] = metric.value
      routeMetrics.totalReqCount += metric.value
      requestMetrics.totalReqCount += metric.value
      quantileCounter++
    } else if (metric.metricName === 'http_request_summary_seconds_sum') {
      routeMetrics.reqSumTime = metric.value * 1000
    } else if (metric.labels && metric.labels.quantile !== undefined) {
      const quantile = metric.labels.quantile
      routeMetrics.reqTime[quantile] = metric.value * 1000

      if (quantileSummary[quantile] === undefined) {
        quantileSummary[quantile] = 0
      }
      quantileSummary[quantile] += metric.value
    }
  }

  const avgReqTimeByQuantile = {}
  for (const quantile in quantileSummary) {
    const summaryReqTimeMs = quantileSummary[quantile] * 1000
    const averageReqTimeMs = roundNumber(summaryReqTimeMs / quantileCounter, 2)
    avgReqTimeByQuantile[quantile] = averageReqTimeMs
  }
  requestMetrics.avgReqTimeByQuantile = avgReqTimeByQuantile

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
      routeMetrics.avgReqTime = roundNumber(routeMetrics.reqSumTime / routeMetrics.totalReqCount, 2)
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
    reply.header('Content-Type', 'application/json')

    if (app.metrics === undefined) {
      reply.status = 404
      reply.send({ error: 'Metrics plugin is not enabled' })
      return
    }

    const metrics = await app.metrics.client.register.getMetricsAsJSON()
    const httpMetrics = metrics.find((metric) => metric.name === 'http_request_summary_seconds').values
    const processUptime = process.uptime()
    return JSON.stringify({ processUptime, ...transformHttpPromMetrics(httpMetrics) }, null, 2)
  })
}
