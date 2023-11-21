'use strict'

module.exports = async function (app) {
  app.get('/hello', async (req, res) => {
    return { hello: 'world' }
  })
}
