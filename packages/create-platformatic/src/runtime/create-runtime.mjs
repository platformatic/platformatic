import { readFile, writeFile } from 'fs/promises'
import { findRuntimeConfigFile } from '../utils.mjs'
import { join, relative, isAbsolute } from 'path'
import * as desm from 'desm'

function generateConfig (version, path, entrypoint) {
  const config = {
    $schema: `https://platformatic.dev/schemas/v${version}/runtime`,
    entrypoint,
    allowCycles: false,
    hotReload: true,
    autoload: {
      path,
      exclude: ['docs']
    }
  }

  return config
}

async function createRuntime (logger, currentDir = process.cwd(), version, servicesDir, entrypoint) {
  if (!version) {
    const pkg = await readFile(desm.join(import.meta.url, '..', '..', 'package.json'))
    version = JSON.parse(pkg).version
  }
  const accessibleConfigFilename = await findRuntimeConfigFile(currentDir)

  if (accessibleConfigFilename === undefined) {
    const path = isAbsolute(servicesDir) ? relative(currentDir, servicesDir) : servicesDir
    const config = generateConfig(version, path, entrypoint)
    await writeFile(join(currentDir, 'platformatic.runtime.json'), JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.runtime.json successfully created.')
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  return {}
}

export default createRuntime
