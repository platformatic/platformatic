'use strict'

module.exports = async function (app) {
  app.get('/time', async (_, reply) => {
    reply.header('Cache-Control', 'public, s-maxage=30')
    return { time: Date.now() }
  })
}
