'use strict'

const fastify = require('fastify')

async function start (opts) {
  const app = fastify()

  // Dumb bearer token implementation
  app.get('/hello', async (req, res) => {
    // We just check if there is an authorization header,
    // which is insecure,
    if (req.headers.authorization) {
      return { hello: 'world' }
    } else {
      res.code(401)
      return { error: 'Unauthorized' }
    }
  })

  return app
}

module.exports = start

if (import.meta.main) {
  start({ logger: { name: 'external' } }).then(app => app.listen({ port: process.env.PORT || 3001 }))
}
