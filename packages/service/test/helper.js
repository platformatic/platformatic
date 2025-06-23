'use strict'

const { createTemporaryDirectory } = require('../../basic/test/helper')
const { createStackable } = require('..')
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

async function createStackableFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const directory = await createTemporaryDirectory(t)

  const service = await createStackable(
    directory,
    options,
    {},
    { applicationFactory, isStandalone: true, isEntrypoint: true }
  )
  t.after(() => service.stop())

  if (!creationOptions.skipInit) {
    await service.init()
  }

  return service
}

module.exports = {
  buildConfig,
  createStackableFromConfig
}
