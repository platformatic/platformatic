const fastify = require('fastify')
const telemetryPlugin = require('../lib/telemetry')
const { createInterface } = require('readline')
const { createReadStream } = require('node:fs')

async function setupApp (pluginOpts, routeHandler, teardown) {
  const app = fastify()
  await app.register(telemetryPlugin, pluginOpts)
  app.get('/test', routeHandler)
  app.ready()
  teardown(async () => {
    await app.close()
    const { exporters } = app.openTelemetry
    exporters.forEach(exporter => {
      if (exporter.constructor.name === 'InMemorySpanExporter') {
        exporter.reset()
      }
    })
  })
  return app
}

function parseNDJson (filePath) {
  const ret = []
  const ndjsonStream = createReadStream(filePath, {
    encoding: 'utf-8'
  })

  const readLine = createInterface({
    input: ndjsonStream,
    crlfDelay: Infinity
  })

  return new Promise(resolve => {
    readLine.on('line', (line) => {
      const parsed = JSON.parse(line)
      ret.push(parsed)
    })

    readLine.on('close', () => {
      resolve(ret)
    })
  })
}

module.exports = {
  setupApp,
  parseNDJson
}
