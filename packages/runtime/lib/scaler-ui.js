import { createReadStream } from 'node:fs'

// Assets are streamed on demand, not loaded or cached when the scaler starts.
export function scalerUi (app, { runtime, onRequest }) {
  const options = { logLevel: 'warn', onRequest }
  const root = new URL('../public/scaler/', import.meta.url)

  app.get('/scaler', options, async (_request, reply) => reply.redirect('scaler/'))

  for (const [path, file, type] of [
    ['/scaler/', 'index.html', 'text/html'],
    ['/scaler/applications', 'index.html', 'text/html'],
    ['/scaler/scaler.css', 'scaler.css', 'text/css'],
    ['/scaler/scaler.js', 'scaler.js', 'text/javascript'],
    ['/scaler/charts.js', 'charts.js', 'text/javascript'],
    ['/scaler/model.js', 'model.js', 'text/javascript'],
    ['/scaler/inter.ttf', 'inter.ttf', 'font/ttf']
  ]) {
    app.get(path, options, async (_request, reply) => {
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'")
      return reply.type(type).send(createReadStream(new URL(file, root)))
    })
  }

  app.get('/scaler/snapshot', options, async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const scaler = runtime.getDynamicWorkersScaler()
    if (typeof scaler?.getDiagnostics !== 'function') {
      return reply.code(503).send({ message: 'Predictive worker scaling (v2) is not running.' })
    }
    const memory = await scaler.getMemoryDiagnostics()
    const snapshot = await scaler.getDiagnostics()
    snapshot.memory = memory
    // Bound presentation values on the request's copy only. The retained Holt
    // level, trend and decision inputs must still represent excess demand.
    for (const application of snapshot.applications) {
      for (const [name, metric] of Object.entries(application.metrics)) {
        const max = name === 'elu' ? 1 : Infinity
        for (const point of metric.history) point.value = Math.max(0, Math.min(max, point.value))
      }
    }
    return snapshot
  })
}
