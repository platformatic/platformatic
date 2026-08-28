import { execute } from '../migrator.js'
import { resolveCommandConfiguration } from './configuration.js'
import { updateSchemaLock } from '../utils.js'
import { generateTypes } from './types.js'

export async function applyMigrations (logger, configuration, args, context) {
  const { parseArgs, logFatalError } = context
  const config = await resolveCommandConfiguration(configuration, context)

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
      await generateTypes(logger, configuration, args, context)
    }

    if (appliedMigrations) {
      await updateSchemaLock(logger, config)
    }

    /*
      There used to be a `utimesSync` here, touching the configuration file so a watching runtime
      would restart. v4 does not reload on a configuration file's mtime -- it watches the files the
      evaluation actually read and reloads on a change to any of them -- and a command has no file
      to touch in any case, since it is handed the configuration as data.
    */
  } catch (err) {
    if (err.code === 'PLT_DB_MIGRATE_ERROR') {
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
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/reference/db/configuration)
`
