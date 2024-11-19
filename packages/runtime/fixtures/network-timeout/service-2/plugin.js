const { setTimeout: sleep } = require('node:timers/promises')

module.exports = async function (app) {
  app.get('/', async (request, reply) => {
    await sleep(1000)
    return { from: 'service' }
  })
}
