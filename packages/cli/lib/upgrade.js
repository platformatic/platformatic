import ConfigManager from '@platformatic/config'
import { analyze, write, upgrade as upgradeConfig } from '@platformatic/metaconfig'
import parseArgs from 'minimist'
import { access } from 'fs/promises'
import { resolve } from 'path'

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
}
