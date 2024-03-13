import { Store, getStringifier } from '@platformatic/config'
import parseArgs from 'minimist'
import { writeFile, readFile } from 'fs/promises'
import { getLatestNpmVersion } from '@platformatic/utils'
import { platformaticService } from '@platformatic/service'
import { platformaticDB } from '@platformatic/db'
import { platformaticComposer } from '@platformatic/composer'
import { platformaticRuntime } from '@platformatic/runtime'
import pino from 'pino'
import pretty from 'pino-pretty'
import { join } from 'desm'

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
    await upgradeSystem(logger)
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

async function upgradeSystem (logger) {
  logger.info('Checking latest platformatic version on npm registry...')
  const { version: currentRunningVersion } = JSON.parse(await readFile(join(import.meta.url, '..', 'package.json')))
  const latestNpmVersion = await getLatestNpmVersion('platformatic')
  if (latestNpmVersion) {
    const compareResult = compareVersions(currentRunningVersion, latestNpmVersion)
    switch (compareResult) {
      case 0:
        logger.info(`✅ You are running the latest Platformatic version v${latestNpmVersion}!`)
        break
      case -1:
        logger.info(`✨ Version ${latestNpmVersion} of Platformatic has been released, please update with "npm update platformatic"`)
        break
    }
  }
}

export function compareVersions (first, second) {
  const [firstMajor, firstMinor, firstPatch] = first.split('.')
  const [secondMajor, secondMinor, secondPatch] = second.split('.')

  if (firstMajor < secondMajor) return -1
  if (firstMajor > secondMajor) return 1

  // firstMajor === secondMajor
  if (firstMinor < secondMinor) return -1
  if (firstMinor > secondMinor) return 1

  // firstMinor === secondMinor
  if (firstPatch < secondPatch) return -1
  if (firstPatch > secondPatch) return 1

  return 0
}
