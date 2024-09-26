'use strict'

const { setTimeout: sleep } = require('node:timers/promises')

module.exports = async function (app) {
  app.ready(async function () {
  })

  await sleep(1000)
}
