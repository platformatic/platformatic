'use strict'

module.exports = async function (app) {
  app.get('/', async () => {
    return { from: 'service' }
  })
}
