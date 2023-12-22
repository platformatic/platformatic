'use strict'

const why = require('why-is-node-running')

setInterval(() => {
  console.log('why is node running?')
  why()
}, 1000 * 60 * 40).unref() // 1 minute

const { Agent, setGlobalDispatcher } = require('undici')

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
