import pino from 'pino'
import pretty from 'pino-pretty'
import { checkForDependencies, generateGlobalTypesFile } from './gen-types.mjs'
import loadConfig from './load-config.mjs'
import { generateJsonSchemaConfig } from './gen-schema.mjs'
import { createDB, parseDBArgs } from 'create-platformatic'
import { join } from 'desm'
import { readFile } from 'fs/promises'

async function init (_args) {
  const version = JSON.parse(await readFile(join(import.meta.url, '../package.json'))).version
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const args = parseDBArgs(_args)
  await createDB(args, logger, process.cwd(), version)

  // We need to do these here because platformatic-creator has NO dependencies to `db`.
  await generateJsonSchemaConfig()
  const { configManager } = await loadConfig({}, _args)
  await configManager.parseAndValidate()
  const config = configManager.current

  if (args.plugin && config.types && config.types.autogenerate) {
    await generateGlobalTypesFile({}, config)
    await checkForDependencies(logger, args, config)
  }
}

export { init }
