import ConfigManager from '@platformatic/config'
import { analyze, write, upgrade as upgradeConfig } from '@platformatic/metaconfig'
import parseArgs from 'minimist'
import { access } from 'fs/promises'
import { resolve } from 'path'
import { request } from 'undici'
const configFileNames = ConfigManager.listConfigFiles()

async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

export async function upgrade (argv) {
  const args = parseArgs(argv, {
    alias: {
      config: 'c'
    }
  })

  let accessibleConfigFilename = args.config

  if (!accessibleConfigFilename) {
    const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName)))
    accessibleConfigFilename = configFileNames.find((value, index) => configFilesAccessibility[index])
  }

  if (!accessibleConfigFilename) {
    console.error('No config file found')
    process.exitCode = 1
    return
  }

  accessibleConfigFilename = resolve(accessibleConfigFilename)

  let meta = await analyze({ file: accessibleConfigFilename })

  console.log(`Found ${meta.version} for Platformatic ${meta.kind} in ${meta.format} format`)

  meta = upgradeConfig(meta)

  await write(meta)
  console.log('Upgraded to', meta.version)

  console.log('Checking latest platformatic version on npm registry...')
  const latestNpmVersion = await checkNpmVersion()
  if (latestNpmVersion) {
    const compareResult = compareVersions(meta.kind, latestNpmVersion)
    switch (compareResult) {
      case 0:
        console.log('✅ You are running the latest Platformatic version!')
        break
      case 1:
        console.log(`✨ Version ${latestNpmVersion} of Platformatic has been released, please update with "npm update -g platformatic"`)
        break
    }
  }
}

async function checkNpmVersion () {
  const res = await request('https://registry.npmjs.org/platformatic')

  if (res.statusCode === 200) {
    const json = await res.body.json()
    return json['dist-tags'].latest
  }
  return null
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
