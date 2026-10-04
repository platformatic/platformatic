'use strict'

const { createCoordinator } = require('./lib/coordinator')
const { createInterceptor } = require('./lib/interceptor')
const { createWire } = require('./lib/wire')

function createThreadInterceptor (opts) {
  const interceptor = createInterceptor(opts)
  return createCoordinator(interceptor)
}

function wire ({ server, port, ...opts }) {
  const interceptor = createInterceptor(opts)
  return createWire(interceptor, server, port, opts)
}

module.exports = { createThreadInterceptor, wire }
