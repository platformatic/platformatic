import { readFile, appendFile, writeFile } from 'fs/promises'
import { findConfigFile, findRuntimeConfigFile } from '../utils.mjs'
import { join, relative, isAbsolute } from 'path'
import * as desm from 'desm'
import { createDynamicWorkspaceGHAction, createStaticWorkspaceGHAction } from '../ghaction.mjs'

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

async function createRuntime (params, logger, currentDir = process.cwd(), version) {
  const {
    servicesDir,
    entrypoint,
    entrypointPort,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction
  } = params

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

  if (servicesDir && entrypoint && entrypointPort) {
    const servicesDirFullPath = isAbsolute(servicesDir)
      ? servicesDir
      : join(currentDir, servicesDir)

    const entrypointPath = join(servicesDirFullPath, entrypoint)
    await updateEntrypointConfig(logger, entrypointPath)
    await updateEntrypointEnv(entrypointPort, logger, entrypointPath)
  }

  if (staticWorkspaceGitHubAction) {
    await createStaticWorkspaceGHAction(logger, serviceEnv, './platformatic.service.json', currentDir, false)
  }
  if (dynamicWorkspaceGitHubAction) {
    await createDynamicWorkspaceGHAction(logger, serviceEnv, './platformatic.service.json', currentDir, false)
  }

  return {}
}

async function updateEntrypointConfig (logger, currentDir) {
  const accessibleConfigFilename = await findConfigFile(currentDir)
  if (accessibleConfigFilename === undefined) {
    logger.error('Cannot find an entrypoint configuration file.')
    return
  }

  const configPath = join(currentDir, accessibleConfigFilename)
  const config = JSON.parse(await readFile(configPath, 'utf8'))

  config.server = {
    hostname: '{PLT_SERVER_HOSTNAME}',
    port: '{PORT}',
    logger: {
      level: '{PLT_SERVER_LOGGER_LEVEL}'
    }
  }

  await writeFile(configPath, JSON.stringify(config, null, 2))
}

async function updateEntrypointEnv (port, logger, currentDir) {
  const env = `\
PLT_SERVER_HOSTNAME=127.0.0.1
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
  `

  await appendFile(join(currentDir, '.env'), env)
  await writeFile(join(currentDir, '.env.sample'), env)
}

export default createRuntime
