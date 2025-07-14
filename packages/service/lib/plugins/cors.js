import fastifyCors from '@fastify/cors'
import fp from 'fastify-plugin'

function originToRegexp (origin) {
  if (typeof origin === 'object') {
    if (origin.regexp) {
      origin = new RegExp(origin.regexp)
    }
  }

  return origin
}

async function setupCorsPlugin (app, cors) {
  let origin = cors.origin
  if (Array.isArray(origin)) {
    origin = origin.map(originToRegexp)
  } else {
    origin = originToRegexp(origin)
  }

  cors.origin = origin
  app.register(fastifyCors, cors)
}

export const setupCors = fp(setupCorsPlugin)
