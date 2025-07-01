'use strict'

const { loadConfig } = require('@platformatic/config')
const { utimesSync } = require('node:fs')
const { createRequire } = require('node:module')
const { generateTypes } = require('./types.js')
const { updateSchemaLock } = require('../utils.js')
const { loadModule } = require('@platformatic/utils')
const { execute } = require('../migrator.js')

async function applyMigrations (logger, configFile, args, context) {
  const { parseArgs, logFatalError } = context
  const platformaticDB = await loadModule(createRequire(__filename), '../../index.js')
  const { configManager } = await loadConfig({}, ['-c', configFile], platformaticDB)
  await configManager.parseAndValidate()
  const config = configManager.current

  const {
    values: { to, rollback }
  } = parseArgs(
    args,
    {
      rollback: {
        type: 'boolean',
        short: 'r'
      },
      to: {
        type: 'string',
        short: 't'
      }
    },
    false
  )

  try {
    const appliedMigrations = await execute(logger, config, to, rollback)

    if (config.types && config.types.autogenerate) {
      await generateTypes(logger, configFile, args, context)
    }

    if (appliedMigrations) {
      await updateSchemaLock(logger, configManager)
    }

    // touch the platformatic db config to trigger a restart
    const now = new Date()

    const configPath = configManager.fullPath
    utimesSync(configPath, now, now)
  } catch (err) {
    if (err.code === 'PTL_DB_MIGRATE_ERROR') {
      logFatalError(logger, err.message)
      return
    }

    /* c8 ignore next 2 */
    throw err
  }
}

const helpFooter = `
The migrations will be applied in the order they are specified in the
folder defined in the configuration file. If you want to apply a specific migration,
you can use the \`--to\` option (use \`000\` to reset to the initial state).

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`

module.exports = { applyMigrations, helpFooter }
