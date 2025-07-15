import { loadConfiguration } from '@platformatic/utils'
import { utimesSync } from 'node:fs'
import { execute } from '../migrator.js'
import { schema } from '../schema.js'
import { updateSchemaLock } from '../utils.js'
import { generateTypes } from './types.js'

export async function applyMigrations (logger, configFile, args, context) {
  const { parseArgs, logFatalError } = context
  const config = await loadConfiguration(configFile, schema)

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
      await updateSchemaLock(logger, config)
    }

    // touch the @platformatic/db config to trigger a restart
    const now = new Date()

    utimesSync(configFile, now, now)
  } catch (err) {
    if (err.code === 'PTL_DB_MIGRATE_ERROR') {
      logFatalError(logger, err.message)
      return
    }

    /* c8 ignore next 2 */
    throw err
  }
}

export const helpFooter = `
The migrations will be applied in the order they are specified in the
folder defined in the configuration file. If you want to apply a specific migration,
you can use the \`--to\` option (use \`000\` to reset to the initial state).

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`
