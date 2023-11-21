import pino from 'pino'
import pretty from 'pino-pretty'
import { access, readFile } from 'fs/promises'
import { setupDB } from './utils.js'
import { Migrator } from './migrator.mjs'
import { pathToFileURL } from 'url'
import { loadConfig } from '@platformatic/config'
import { platformaticDB } from '../index.js'
import errors from './errors.js'
import { tsCompiler } from '@platformatic/service'
import { join, resolve } from 'node:path'

async function execute (logger, seedFile, config) {
  const { db, sql, entities } = await setupDB(logger, config.db)

  await access(seedFile)

  logger.info(`seeding from ${seedFile}`)
  let seedFunction
  const importedFunction = await import(pathToFileURL(seedFile))

  if (typeof importedFunction === 'function') {
    seedFunction = importedFunction
  } else if (typeof importedFunction.seed === 'function') {
    seedFunction = importedFunction.seed
  } else if (typeof importedFunction.default === 'function') {
    seedFunction = importedFunction.default
  }

  if (!seedFunction) {
    logger.error('Cannot find seed function.')
    logger.error('If you use an ESM module use the signature \'export async function seed (opts)\'.')
    logger.error('If you use a CJS module use the signature \'module.exports = async function seed (opts)\'.')
    logger.error('If you use Typescript use the signature \'export async function seed(opts)\'')
    return
  }
  await seedFunction({ db, sql, entities, logger })
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
  let seedFile = args._[0]
  if (!seedFile) {
    throw new errors.MissingSeedFileError()
  }
  // check if we are in Typescript and, in case, compile it
  if (seedFile.endsWith('.ts')) {
    await tsCompiler.compile(process.cwd(), configManager.current, logger)
    const tsConfigPath = config?.plugins?.typescript?.tsConfig || resolve(process.cwd(), 'tsconfig.json')
    const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
    const outDir = tsConfig.compilerOptions.outDir
    seedFile = join(outDir, seedFile.replace('.ts', '.js'))
  }
  await execute(logger, seedFile, config)
}

export { seed, execute }
