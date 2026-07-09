'use strict'

module.exports = async function (app) {
  app.post('/crash', async () => {
    setImmediate(() => {
      throw new Error('kaboom')
    })
  })
}
