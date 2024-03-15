'use strict'

const os = require('node:os')
const http = require('node:http')
const { eventLoopUtilization } = require('node:perf_hooks').performance
const fastify = require('fastify')
const fp = require('fastify-plugin')

const metricsPlugin = fp(async function (app, opts = {}) {
  const defaultMetrics = opts.defaultMetrics ?? { enabled: true }
  const prefix = opts.prefix ?? ''

  app.register(require('fastify-metrics'), {
    defaultMetrics: defaultMetrics || { enabled: true },
    endpoint: null,
    name: 'metrics',
    clearRegisterOnInit: false,
    routeMetrics: {
      enabled: true,
      overrides: {
        histogram: {
          name: prefix + 'http_request_duration_seconds'
        },
        summary: {
          name: prefix + 'http_request_summary_seconds'
        }
      }
    }
  })

  app.register(fp(async (app) => {
    const httpLatencyMetric = new app.metrics.client.Summary({
      name: prefix + 'http_request_all_summary_seconds',
      help: 'request duration in seconds summary for all requests',
      collect: () => {
        process.nextTick(() => httpLatencyMetric.reset())
      }
    })
    const ignoredMethods = ['HEAD', 'OPTIONS', 'TRACE', 'CONNECT']
    const timers = new WeakMap()
    app.addHook('onRequest', async (req) => {
      if (ignoredMethods.includes(req.method)) return
      const timer = httpLatencyMetric.startTimer()
      timers.set(req, timer)
    })
    app.addHook('onResponse', async (req) => {
      if (ignoredMethods.includes(req.method)) return
      const timer = timers.get(req)
      if (timer) {
        timer()
        timers.delete(req)
      }
    })
  }, {
    encapsulate: false
  }))

  if (defaultMetrics.enabled) {
    app.register(async (app) => {
      let startELU = eventLoopUtilization()
      const eluMetric = new app.metrics.client.Gauge({
        name: 'nodejs_eventloop_utilization',
        help: 'The event loop utilization as a fraction of the loop time. 1 is fully utilized, 0 is fully idle.',
        collect: () => {
          const endELU = eventLoopUtilization()
          const result = eventLoopUtilization(endELU, startELU).utilization
          eluMetric.set(result)
          startELU = endELU
        }
      })
      app.metrics.client.register.registerMetric(eluMetric)

      let previousIdleTime = 0
      let previousTotalTime = 0
      const cpuMetric = new app.metrics.client.Gauge({
        name: 'process_cpu_percent_usage',
        help: 'The process CPU percent usage.',
        collect: () => {
          const cpus = os.cpus()
          let idleTime = 0
          let totalTime = 0

          cpus.forEach(cpu => {
            for (const type in cpu.times) {
              totalTime += cpu.times[type]
              if (type === 'idle') {
                idleTime += cpu.times[type]
              }
            }
          })

          const idleDiff = idleTime - previousIdleTime
          const totalDiff = totalTime - previousTotalTime

          const usagePercent = 100 - ((100 * idleDiff) / totalDiff)
          const roundedUsage = Math.round(usagePercent * 100) / 100
          cpuMetric.set(roundedUsage)

          previousIdleTime = idleTime
          previousTotalTime = totalTime
        }
      })
      app.metrics.client.register.registerMetric(cpuMetric)
    })
  }

  let isRestarting = false
  app.addHook('onReady', async () => {
    app.addPreRestartHook(async () => {
      isRestarting = true
      app.metrics.client.register.clear()
    })
  })
  app.addHook('onClose', async () => {
    if (!isRestarting) {
      app.metrics.client.register.clear()
    }
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

  app.register(metricsPlugin, opts)

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
