'use strict'

const { loadConfig } = require('@platformatic/config')
const tsCompiler = require('@platformatic/ts-compiler')
const { access, readFile } = require('fs/promises')
const { createRequire } = require('node:module')
const { join, resolve } = require('node:path')
const errors = require('../errors.js')
const { Migrator } = require('../migrator.js')
const { setupDB } = require('../utils.js')
const { loadModule } = require('@platformatic/utils')

async function seed (logger, configFile, args, { colorette: { bold }, logFatalError }) {
  const platformaticDB = await loadModule(createRequire(__filename), '../../index.js')
  const { configManager } = await loadConfig({}, ['-c', configFile], platformaticDB)
  await configManager.parseAndValidate()
  const config = configManager.current

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
    throw new errors.MissingSeedFileError()
  }

  let seedFile = resolve(process.cwd(), args[0])

  // check if we are in Typescript and, in case, compile it
  if (seedFile.endsWith('.ts')) {
    await tsCompiler.compile({
      cwd: process.cwd(),
      logger,
      tsConfig: configManager.current.plugins?.typescript?.tsConfig,
      flags: configManager.current.plugins?.typescript?.flags
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

const helpFooter = `
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

module.exports = { seed, helpFooter }
