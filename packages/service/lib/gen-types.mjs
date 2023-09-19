import { join, dirname } from 'path'
import { createRequire } from 'module'
import { writeFile, readFile } from 'fs/promises'
import pino from 'pino'
import pretty from 'pino-pretty'
import { isFileAccessible } from './utils.js'
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
async function writeFileIfChanged (filename, content) {
  const isFileExists = await isFileAccessible(filename)
  if (isFileExists) {
    const fileContent = await readFile(filename, 'utf-8')
    if (fileContent === content) return false
  }
  await writeFile(filename, content)
  return true
}

async function execute ({ logger, configManager }) {
  const fileNameOrThen = join(dirname(configManager.fullPath), 'global.d.ts')
  await writeFileIfChanged(fileNameOrThen, GLOBAL_TYPES_TEMPLATE)
}

async function generateTypes (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager, args } = await loadConfig({}, _args, platformaticService)

  await configManager.parseAndValidate()
  const config = configManager.current

  await execute({ logger, configManager })
  await checkForDependencies(logger, args, createRequire(import.meta.url), config, ['@platformatic/service'])
}

export { execute, generateTypes }
