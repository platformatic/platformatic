#! /usr/bin/env node

import { Migrator } from './migrator.mjs'
import isMain from 'es-main'
import pino from 'pino'
import pretty from 'pino-pretty'
import { MigrateError } from './errors.mjs'
import loadConfig from './load-config.mjs'
import { execute as generateTypes, checkForDependencies } from './gen-types.mjs'
import { utimesSync } from 'fs'

async function execute (logger, args, config) {
  const migrationsConfig = config.migrations
  if (migrationsConfig === undefined) {
    throw new MigrateError('Missing migrations in config file')
  }

  const migrator = new Migrator(migrationsConfig, config.core, logger)

  try {
    if (args.rollback) {
      await migrator.rollbackMigration()
    } else {
      await migrator.applyMigrations(args.to)
    }
  } catch (error) {
    logger.error(error)
    throw error
  } finally {
    await migrator.close()
  }
}

async function applyMigrations (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  try {
    const { configManager, args } = await loadConfig({
      string: ['to'],
      boolean: ['rollback'],
      alias: {
        t: 'to',
        r: 'rollback'
      }
    }, _args)

    await configManager.parseAndValidate()
    const config = configManager.current

    await execute(logger, args, config)

    if (config.types && config.types.autogenerate) {
      await generateTypes(logger, args, config)
      await checkForDependencies(logger, args, config)
    }

    // touch the platformatic db config to trigger a restart
    const now = new Date()

    const configPath = configManager.fullPath
    utimesSync(configPath, now, now)
  } catch (err) {
    if (err instanceof MigrateError) {
      logger.error(err.message)
      process.exit(1)
    }
    /* c8 ignore next 2 */
    throw err
  }
}

export { applyMigrations, execute }

if (isMain(import.meta)) {
  await applyMigrations(process.argv.splice(2))
}
