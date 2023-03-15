'use strict'

const why = require('why-is-node-running')
const { Agent, setGlobalDispatcher } = require('undici')

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
setInterval(() => {
  why()
}, 20000).unref()

const agent = new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
})
setGlobalDispatcher(agent)

function buildConfig (options) {
  const base = {
    server: {}
  }

  return Object.assign(base, options)
}

module.exports.buildConfig = buildConfig
