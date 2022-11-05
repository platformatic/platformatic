'use strict'

const undici = require('undici')

module.exports = async function (app) {
  app.get('/request', async function () {
    try {
      const res = await undici.request('http://localhost:42')
      return await res.body.json()
    } catch (err) {
      console.log(err)
      throw err
    }
  })
}
