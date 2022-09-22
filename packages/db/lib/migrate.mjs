#! /usr/bin/env node

import { execute } from './migrator.mjs'
import isMain from 'es-main'
import pino from 'pino'
import pretty from 'pino-pretty'
import { MigrateError } from './errors.mjs'
import loadConfig from './load-config.mjs'
import { execute as generateTypes, checkForDependencies, generatePluginWithTypesSupport } from './gen-types.mjs'

async function migrate (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  try {
    const { configManager, args } = await loadConfig({
      string: ['to'],
      alias: {
        t: 'to'
      }
    }, _args)

    await configManager.parseAndValidate()
    const config = configManager.current

    await execute(logger, args, config)

    if (config.types && config.types.autogenerate) {
      await generateTypes(logger, args, config)
      await generatePluginWithTypesSupport(logger, args, configManager)
      await checkForDependencies(logger, args, config)
    }
  } catch (err) {
    if (err instanceof MigrateError) {
      logger.error(err.message)
      process.exit(1)
    }
    /* c8 ignore next 2 */
    throw err
  }
}

export { migrate, execute }

if (isMain(import.meta)) {
  await migrate(process.argv.splice(2))
}
