'use strict'

module.exports = async function (app) {
  app.get('/custom', async function (req, reply) {
    reply.send({ hello: 'world' })
  })
}
