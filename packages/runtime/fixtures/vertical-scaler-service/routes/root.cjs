'use strict'

module.exports = async function (fastify) {
  fastify.post('/cpu-intensive', async (req) => {
    // Simulate a CPU intensive operation
    const timeout = req.body.timeout ?? 1000
    const start = Date.now()

    // eslint-disable-next-line no-empty
    while (Date.now() - start < timeout) {}

    return { status: 'ok' }
  })
}
