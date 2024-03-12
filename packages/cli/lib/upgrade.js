import { Store, getStringifier } from '@platformatic/config'
import parseArgs from 'minimist'
import { writeFile } from 'fs/promises'
import { execa } from 'execa'
import { getLatestNpmVersion } from '@platformatic/utils'
import { platformaticService } from '@platformatic/service'
import { platformaticDB } from '@platformatic/db'
import { platformaticComposer } from '@platformatic/composer'
import { platformaticRuntime } from '@platformatic/runtime'

export async function upgrade (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c'
    }
  })
  try {
    await upgradeSystem()
    await upgradeApp(args.config)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

async function upgradeApp (config) {
  const store = new Store({
    cwd: process.cwd()
  })
  store.add(platformaticService)
  store.add(platformaticDB)
  store.add(platformaticComposer)
  store.add(platformaticRuntime)

  const { configManager, app } = await store.loadConfig({
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

  console.log(`Updating for ${app.configType}`)

  const newConfig = stringify(configManager.current)

  console.log(configManager.current)

  await writeFile(configManager.fullPath, newConfig, 'utf8')
}

async function upgradeSystem () {
  console.log('Checking latest platformatic version on npm registry...')
  const currentRunningVersion = await checkSystemPlatformaticVersion()
  const latestNpmVersion = await getLatestNpmVersion('platformatic')
  if (latestNpmVersion) {
    const compareResult = compareVersions(currentRunningVersion, latestNpmVersion)
    switch (compareResult) {
      case 0:
        console.log(`✅ You are running the latest Platformatic version v${latestNpmVersion}!`)
        break
      case -1:
        console.log(`✨ Version ${latestNpmVersion} of Platformatic has been released, please update with "npm update -g platformatic"`)
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

async function checkSystemPlatformaticVersion () {
  const { stdout } = await execa('platformatic', ['--version'])
  if (stdout.match(/v\d+\.\d+\.\d+/)) {
    return stdout.substring(1)
  }
  return '0.0.0'
}
