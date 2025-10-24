'use strict'

const { request } = require('undici')

module.exports = async function (fastify) {
  fastify.post('/service-2/cpu-intensive', async (req) => {
    await request('http://service-2.plt.local/cpu-intensive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: req.body
    })
  })

  fastify.post('/custom-health-signal', async (req) => {
    const signal = req.body
    await globalThis.platformatic.sendHealthSignal(signal)
  })
}
