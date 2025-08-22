'use strict'

const fastify = require('fastify')
const formBody = require('@fastify/formbody')
const { createSigner } = require('fast-jwt')

async function start (opts) {
  const app = fastify(opts)
  let port = opts.port

  const signSync = createSigner({
    key: 'secret',
    expiresIn: '1h'
  })

  app.decorate('refreshToken', '')
  app.decorate('signSync', signSync)

  app.register(formBody)

  // Dump bearer token implementation
  app.post('/token', async (req, res) => {
    return { access_token: signSync({}) }
  })

  await app.listen({ port })

  port = app.server.address().port

  const refreshToken = signSync({
    iss: `http://localhost:${port}`
  })

  app.refreshToken = refreshToken

  app.log.info({ refreshToken }, 'refresh token')

  return app
}

module.exports = start

if (import.meta.main) {
  start({ logger: { name: 'idp' }, port: process.env.PORT || 3000 }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}
