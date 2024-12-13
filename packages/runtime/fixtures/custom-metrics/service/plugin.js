'use strict'

const { client, registry } = globalThis.platformatic.prometheus

const metric1 = new client.Counter({
  name: 'custom_service_1',
  help: 'Custom Service 1',
  registers: [registry]
})

setTimeout(() => {
  metric1.inc(123)
}, 200)

module.exports = async function (app) {
  const metric2 = new client.Gauge({
    name: 'custom_service_2',
    help: 'Custom Service 2',
    registers: [registry]
  })

  setTimeout(() => {
    metric2.set(456)
  }, 200)

  app.get('/hello', async (request, reply) => {
    return { from: 'service' }
  })
}
