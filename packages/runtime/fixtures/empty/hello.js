'use strict'

module.exports = async function (app) {
  app.get('/hello', async () => {
    return { hello: 'hello123' }
  })
}
