'use strict'

module.exports = async function (app) {
  app.get('/hello', async (req) => {
    const intercepted = req.headers.intercepted === 'true'
    return { hello: 'world', intercepted }
  })
}
