'use strict'

const jwt = require('@fastify/jwt')
const fp = require('fastify-plugin')
const buildGetJwks = require('get-jwks')

module.exports = fp(async function (app, opts) {
  // opts.jwks can be `true` (to enable with no options)
  // or options from https://github.com/nearform/get-jwks#options
  if (opts.jwks) {
    const getJwks = buildGetJwks(typeof opts.jwks === 'object' ? opts.jwks : {})
    app.register(jwt, {
      ...opts,
      decode: { complete: true },
      secret: function (request, token) {
        const {
          header: { kid, alg },
          payload: { iss }
        } = token
        return getJwks.getPublicKey({ kid, domain: iss, alg })
      }
    })
  } else {
    app.register(jwt, opts)
  }

  app.decorateRequest('createJWTSession', function () {
    return this.jwtVerify()
  })
})
