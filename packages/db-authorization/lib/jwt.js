'use strict'

const jwt = require('@fastify/jwt')
const fp = require('fastify-plugin')
const buildGetJwks = require('get-jwks')

module.exports = fp(async function (app, opts) {
  // opts.jwks can be `true` (to enable with no options)
  // or options from https://github.com/nearform/get-jwks#options

  const namespace = opts?.namespace
  // @fastify/jwt does not init correctly if `namespace` is set in options, so we remove it
  delete opts.namespace
  const formatUser = namespace
    ? user => {
      const userDataNoNamespace = {}
      for (const key of Object.keys(user)) {
        if (key.startsWith(namespace)) {
          userDataNoNamespace[key.slice(namespace.length)] = user[key]
        } else {
          userDataNoNamespace[key] = user[key]
        }
      }
      return userDataNoNamespace
    }
    : user => user

  if (opts.jwks) {
    const getJwks = buildGetJwks(typeof opts.jwks === 'object' ? opts.jwks : {})
    app.register(jwt, {
      formatUser,
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
    app.register(jwt, { formatUser, ...opts })
  }

  app.decorateRequest('createJWTSession', function () {
    return this.jwtVerify()
  })
})
