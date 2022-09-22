import { resolve } from 'path'
import pino from 'pino'
import pretty from 'pino-pretty'
import { access } from 'fs/promises'
import { setupDB } from './utils.js'
import { SeedError } from './errors.mjs'
import { execute as migrator } from './migrator.mjs'
import { pathToFileURL } from 'url'
import loadConfig from './load-config.mjs'
async function execute (logger, args, config) {
  const { db, sql, entities } = await setupDB(logger, config.core)

  const seedFile = args._[0]

  if (!seedFile) {
    throw new SeedError('Missing seed file')
  }

  await access(seedFile)

  logger.info(`seeding from ${seedFile}`)
  const { default: seed } = await import(pathToFileURL(seedFile))

  await seed({ db, sql, entities })
  logger.info('seeding complete')

  // Once done seeding, close your connection.
  await db.dispose()
}

async function seed (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  try {
    const { configManager, args } = await loadConfig({
      default: {
        config: resolve(process.cwd(), 'platformatic.db.json')
      },
      alias: {
        c: 'config'
      }
    }, _args)
    await configManager.parseAndValidate()
    const config = configManager.current

    await migrator(logger, args, config)
    await execute(logger, args, config)
  } catch (err) {
    if (err instanceof SeedError) {
      logger.error(err.message)
      process.exit(1)
    }
    /* c8 ignore next 2 */
    throw err
  }
}

export { seed, execute }
