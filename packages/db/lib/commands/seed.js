import tsCompiler from '@platformatic/ts-compiler'
import { loadConfiguration, loadModule } from '@platformatic/utils'
import { access, readFile } from 'fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { MissingSeedFileError } from '../errors.js'
import { Migrator } from '../migrator.js'
import { schema } from '../schema.js'
import { setupDB } from '../utils.js'

export async function seed (logger, configFile, args, { colorette: { bold }, logFatalError }) {
  const config = await loadConfiguration(configFile, schema)

  if (config.migrations !== undefined) {
    const migrator = new Migrator(config.migrations, config.db, logger)

    try {
      const hasMigrationsToApply = await migrator.hasMigrationsToApply()
      if (hasMigrationsToApply) {
        logFatalError(logger, 'You must apply migrations before seeding the database.')
        return
      }
    } finally {
      await migrator.close()
    }
  }

  if (!args.length) {
    throw new MissingSeedFileError()
  }

  let seedFile = resolve(process.cwd(), args[0])

  // check if we are in Typescript and, in case, compile it
  if (seedFile.endsWith('.ts')) {
    await tsCompiler.compile({
      cwd: process.cwd(),
      logger,
      tsConfig: config.plugins?.typescript?.tsConfig,
      flags: config.plugins?.typescript?.flags
    })
    const tsConfigPath = config?.plugins?.typescript?.tsConfig || resolve(process.cwd(), 'tsconfig.json')
    const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
    const outDir = tsConfig.compilerOptions.outDir
    seedFile = join(outDir, seedFile.replace('.ts', '.js'))
  }

  await access(seedFile)

  logger.info(`Seeding from ${bold(seedFile)}`)

  const importedModule = await loadModule(createRequire(resolve(process.cwd(), 'noop.js')), seedFile)

  const seedFunction = typeof importedModule?.seed !== 'function' ? importedModule : importedModule

  if (typeof seedFunction !== 'function') {
    logFatalError(logger, 'Cannot find seed function.')
    logFatalError(logger, "If you use an ESM module use the signature 'export async function seed (opts)'.")
    logFatalError(logger, "If you use a CJS module use the signature 'module.exports = async function seed (opts)'.")
    logFatalError(logger, "If you use Typescript use the signature 'export async function seed(opts)'")
    return
  }

  const { db, sql, entities } = await setupDB(logger, config.db)
  await seedFunction({ db, sql, entities, logger })
  logger.info('Seeding complete.')

  // Once done seeding, close your connection.
  await db.dispose()
}

export const helpFooter = `
This is a convenience method that loads a JavaScript file and configure @platformatic/sql-mapper to connect to the database specified in the configuration file.

Here is an example of a seed file:

\`\`\`
'use strict'

module.exports = async function ({ entities, db, sql }) {
  await entities.graph.save({ input: { name: 'Hello' } })
  await db.query(sql\`INSERT INTO graphs (name) VALUES ('Hello 2');\`)
}
\`\`\`

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/db/configuration)
`
