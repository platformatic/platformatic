'use strict'

const { setTimeout: sleep } = require('node:timers/promises')

module.exports = async function (app) {
  app.addHook('onClose', async () => {
    await sleep(11000)

    console.log('clean up hook')
  })
}
