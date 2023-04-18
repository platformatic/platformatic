'use strict'

// const why = require('why-is-node-running')
const { Agent, setGlobalDispatcher } = require('undici')
const tap = require('tap')

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
// setInterval(() => {
//  why()
// }, 60000).unref()

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
