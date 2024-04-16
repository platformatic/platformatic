'use strict'

const { setTimeout: sleep } = require('timers/promises')

module.exports = async function (fastify, options) {
  setImmediate(() => {
    throw new Error('Crash!')
  })

  await sleep(1000)
}
