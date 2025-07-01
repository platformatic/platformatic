'use strict'

const { createRequire } = require('node:module')
const { loadConfig } = require('@platformatic/config')
const { loadModule, abstractLogger } = require('@platformatic/utils')
const { printSchema: printGraphqlSchema } = require('graphql')

async function printSchema (logger, configFile, args, { colorette: { bold }, logFatalError }) {
  const platformaticDB = await loadModule(createRequire(__filename), '../../index.js')
  const { configManager } = await loadConfig({}, ['-c', configFile], platformaticDB)
  await configManager.parseAndValidate()

  const type = args[0]

  if (!type) {
    logFatalError(logger, `Please specify a schema type between ${bold('openapi')} and ${bold('graphql')}.`)
  } else if (type !== 'openapi' && type !== 'graphql') {
    logFatalError(logger, `Invalid schema type ${bold(type)}. Use ${bold('openapi')} or ${bold('graphql')}.`)
  }

  const app = await platformaticDB.create(configManager.dirname, configManager.fullPath, {}, { logger: abstractLogger })
  await app.init()

  let output
  if (type === 'openapi') {
    await app.start({ listen: true })
    output = JSON.stringify(app.getApplication().swagger(), null, 2)
  } else {
    output = printGraphqlSchema(app.getApplication().graphql.schema)
  }

  console.log(output)
  await app.stop()
}

module.exports = { printSchema }
