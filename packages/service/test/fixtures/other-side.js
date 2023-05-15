'use strict'

module.exports = async function (app) {
  app.addHook('onRequest', async () => {
    throw new TypeError('kaboom')
  })
}

module.exports[Symbol.for('skip-override')] = true
