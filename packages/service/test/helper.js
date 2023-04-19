'use strict'

const { Agent, setGlobalDispatcher } = require('undici')
const tap = require('tap')

const agent = new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
})

setGlobalDispatcher(agent)

// This should not be needed, but a weird combination
// of node-tap, Windows, c8 and ESM makes this necessary.
tap.teardown(() => {
  process.exit(0)
})

function buildConfig (options) {
  const base = {
    server: {}
  }

  return Object.assign(base, options)
}

module.exports.buildConfig = buildConfig
