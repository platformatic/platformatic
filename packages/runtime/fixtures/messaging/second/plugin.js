const { threadId } = require('node:worker_threads')

globalThis.platformatic.messaging.handle({
  async thread () {
    return `T${threadId}`
  }
})

module.exports = async function (app) {
  app.get('/hello', async () => {
    return { from: 'service' }
  })
}
