'use strict'

const fp = require('fastify-plugin')

function originToRegexp (origin) {
  if (typeof origin === 'object') {
    if (origin.regexp) {
      origin = new RegExp(origin.regexp)
    }
  }

  return origin
}

async function setupClients (app, opts) {
  const cors = opts

  let origin = cors.origin
  if (Array.isArray(origin)) {
    origin = origin.map(originToRegexp)
  } else {
    origin = originToRegexp(origin)
  }

  cors.origin = origin
  app.register(require('@fastify/cors'), cors)
}

module.exports = fp(setupClients)
