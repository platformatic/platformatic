'use strict'

const { client, registry } = globalThis.platformatic.prometheus

module.exports = async function (app) {
  const metric = new client.Gauge({
    name: 'custom_metric',
    help: 'Custom Service 2',
    registers: [registry]
  })

  // Block the process for 10 seconds before setting the metric
  setTimeout(() => {
    const start = Date.now()
    while (Date.now() < start + 10000) {
      Math.sqrt(Math.random())
    }

    metric.set(456)
  }, 200)

  app.get('/hello', async (request, reply) => {
    return { from: 'service' }
  })
}
