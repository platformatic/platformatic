'use strict'

const { loadConfig } = require('@platformatic/config')
const { loadModule } = require('@platformatic/utils')
const { createRequire } = require('node:module')
const { execute } = require('../types.js')

async function generateTypes (logger, configFile, _args) {
  const platformaticDB = await loadModule(createRequire(__filename), '../../index.js')
  const { configManager } = await loadConfig({}, ['-c', configFile], platformaticDB)
  await configManager.parseAndValidate()
  const config = configManager.current

  const count = await execute({ logger, config, configManager })

  if (count === 0) {
    logger.warn('No entities found in your schema. Types were NOT generated.')
    logger.warn('Make sure you have applied all the migrations and try again.')
  }
}

const helpFooter = `
As a result of executing this command, the Platformatic DB will generate a \`types\` folder with a typescript file for each database entity. It will also generate a \`global.d.ts\` file that injects the types into the Application instance.

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`
module.exports = { generateTypes, helpFooter }
