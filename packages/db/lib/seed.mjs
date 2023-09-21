import pino from 'pino'
import pretty from 'pino-pretty'
import { access } from 'fs/promises'
import { setupDB } from './utils.js'
import { Migrator } from './migrator.mjs'
import { pathToFileURL } from 'url'
import { loadConfig } from '@platformatic/config'
import { platformaticDB } from '../index.js'
import errors from './errors.js'

async function execute (logger, args, config) {
  const { db, sql, entities } = await setupDB(logger, config.db)

  const seedFile = args._[0]

  if (!seedFile) {
    throw new errors.MissingSeedFileError()
  }

  await access(seedFile)

  logger.info(`seeding from ${seedFile}`)
  const { default: seed } = await import(pathToFileURL(seedFile))

  await seed({ db, sql, entities, logger })
  logger.info('seeding complete')

  // Once done seeding, close your connection.
  await db.dispose()
}

async function seed (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager, args } = await loadConfig({
    alias: {
      c: 'config'
    }
  }, _args, platformaticDB)
  await configManager.parseAndValidate()
  const config = configManager.current

  if (config.migrations !== undefined) {
    const migrator = new Migrator(config.migrations, config.db, logger)

    try {
      const hasMigrationsToApply = await migrator.hasMigrationsToApply()
      if (hasMigrationsToApply) {
        throw new errors.MigrationsToApplyError()
      }
    } finally {
      await migrator.close()
    }
  }

  await execute(logger, args, config)
}

export { seed, execute }
