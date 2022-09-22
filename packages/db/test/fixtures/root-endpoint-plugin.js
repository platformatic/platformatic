'use strict'

module.exports = async function (app) {
  console.log('plugin loaded')
  app.get('/', async function () {
    return { message: 'Root Plugin' }
  })
}
