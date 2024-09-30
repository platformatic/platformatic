'use strict'

const why = require('why-is-node-running')

if (process.env.WHY === 'true') {
  setInterval(() => {
    console.log('why is node running?')
    why()
  }, 60000).unref()
}

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
