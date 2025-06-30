'use strict'

const { createTemporaryDirectory } = require('../../basic/test/helper')
const { create } = require('..')
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

async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const directory = await createTemporaryDirectory(t)

  const service = await create(
    directory,
    options,
    {},
    { applicationFactory, isStandalone: true, isEntrypoint: true, isProduction: creationOptions.production }
  )
  t.after(() => service.stop())

  if (!creationOptions.skipInit) {
    await service.init()
  }

  return service
}

module.exports = {
  buildConfig,
  createFromConfig
}
