#! /usr/bin/env node

import { Migrator } from './migrator.mjs'
import isMain from 'es-main'
import pino from 'pino'
import pretty from 'pino-pretty'
import { MigrateError } from './errors.mjs'
import { checkForDependencies } from '@platformatic/utils'
import { createRequire } from 'node:module'
import { execute as generateTypes } from './gen-types.mjs'
import { utimesSync } from 'fs'
import { updateSchemaLock } from './utils.js'
import { loadConfig } from '@platformatic/config'
import { platformaticDB } from '../index.js'

async function execute ({ logger, rollback, to, config }) {
  const migrationsConfig = config.migrations
  if (migrationsConfig === undefined) {
    throw new MigrateError('Missing "migrations" section in config file')
  }
  const migrator = new Migrator(migrationsConfig, config.db, logger)

  try {
    if (rollback) {
      await migrator.rollbackMigration()
    } else {
      await migrator.applyMigrations(to)
    }
    return migrator.appliedMigrationsCount > 0
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
    }, _args, platformaticDB)

    const config = configManager.current
    const appliedMigrations = await execute({ logger, ...args, config })

    if (config.types && config.types.autogenerate) {
      await generateTypes({ logger, config })
      await checkForDependencies(logger, args, createRequire(import.meta.url), config, ['@platformatic/db', 'typescript'])
    }

    if (appliedMigrations) {
      await updateSchemaLock(logger, configManager)
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
