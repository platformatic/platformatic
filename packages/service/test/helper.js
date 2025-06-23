'use strict'

const { safeRemove } = require('@platformatic/utils')
const { join } = require('node:path')
const { createStackable } = require('..')

let tmpCount = 0
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

async function createTemporaryDirectory (t) {
  const directory = join(__dirname, `../../../tmp/plt-service-${process.pid}-${tmpCount++}`)
  t.after(() => safeRemove(directory))
  return directory
}

async function createStackableFromConfig (t, options, applicationFactory) {
  const directory = await createTemporaryDirectory(t)
  return createStackable(directory, options, {}, { applicationFactory, isStandalone: true, isEntrypoint: true })
}

module.exports = {
  buildConfig,
  createTemporaryDirectory,
  createStackableFromConfig
}
