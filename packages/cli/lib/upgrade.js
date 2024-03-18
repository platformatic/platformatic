import { Store, getStringifier } from '@platformatic/config'
import parseArgs from 'minimist'
import { writeFile } from 'fs/promises'
import { platformaticService } from '@platformatic/service'
import { platformaticDB } from '@platformatic/db'
import { platformaticComposer } from '@platformatic/composer'
import { platformaticRuntime } from '@platformatic/runtime'
import pino from 'pino'
import pretty from 'pino-pretty'

export async function upgrade (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c'
    }
  })

  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))
  try {
    await upgradeApp(args.config, logger)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

async function upgradeApp (config, logger) {
  const store = new Store({
    cwd: process.cwd(),
    logger
  })
  store.add(platformaticService)
  store.add(platformaticDB)
  store.add(platformaticComposer)
  store.add(platformaticRuntime)

  const { configManager } = await store.loadConfig({
    config,
    overrides: {
      fixPaths: false,
      onMissingEnv (key) {
        return ''
      }
    }
  })

  await configManager.parseAndValidate()

  const stringify = getStringifier(configManager.fullPath)

  const newConfig = stringify(configManager.current)

  await writeFile(configManager.fullPath, newConfig, 'utf8')

  logger.info(`✅ Updated ${configManager.fullPath}`)
}
