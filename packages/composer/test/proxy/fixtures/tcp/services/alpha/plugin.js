'use strict'

module.exports = async function (app) {
  app.get('/', async (req, res) => {
    return { from: 'alpha' }
  })
}
