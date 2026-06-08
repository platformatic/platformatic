const { threadId } = require('node:worker_threads')

module.exports = async function (app) {
  const { getMessaging } = require('@platformatic/globals')

  const messaging = getMessaging()
  messaging.handle({
    async thread () {
      return `T${threadId}`
    }
  })

  app.get('/hello', async () => {
    return { from: 'service' }
  })
}
