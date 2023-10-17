import { join, dirname } from 'path'
import { createRequire } from 'module'
import { writeFile } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { loadConfig } from '@platformatic/config'
import { platformaticService } from '../index.js'
import { checkForDependencies } from '@platformatic/utils'

const GLOBAL_TYPES_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticServiceConfig } from '@platformatic/service'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticServiceConfig>
  }
}
`
async function execute ({ logger, configManager }) {
  const fileNameOrThen = join(dirname(configManager.fullPath), 'global.d.ts')
  await writeFile(fileNameOrThen, GLOBAL_TYPES_TEMPLATE)
}

async function generateTypes (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))
  const { configManager, args } = await loadConfig({}, _args, platformaticService)

  console.log('antanis', new Error().stack)
  await configManager.parseAndValidate()
  const config = configManager.current

  await execute({ logger, configManager })
  await checkForDependencies(logger, args, createRequire(import.meta.url), config, ['@platformatic/service'])
}

export { execute, generateTypes }
