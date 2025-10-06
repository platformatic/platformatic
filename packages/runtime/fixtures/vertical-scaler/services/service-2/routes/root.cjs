'use strict'

const sleep = require('atomic-sleep')

module.exports = async function (fastify) {
  fastify.post('/cpu-intensive', async (req) => {
    // Simulate a CPU intensive operation
    const timeout = req.body.timeout ?? 1000
    sleep(timeout)

    return { status: 'ok' }
  })
}
