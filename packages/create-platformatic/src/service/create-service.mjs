import { writeFile, readFile, appendFile } from 'fs/promises'
import { join } from 'path'
import * as desm from 'desm'
import { addPrefixToEnv } from '../utils.mjs'
import { getTsConfig } from '../get-tsconfig.mjs'
import { generatePlugins } from '../create-plugins.mjs'
import { createDynamicWorkspaceGHAction, createStaticWorkspaceGHAction } from '../ghaction.mjs'
import { createGitRepository } from '../create-git-repository.mjs'

const TS_OUT_DIR = 'dist'

function generateConfig (isRuntimeContext, version, typescript, envPrefix) {
  const plugins = {
    paths: [
      { path: './plugins', encapsulate: false },
      './routes'
    ]
  }

  const config = {
    $schema: `https://platformatic.dev/schemas/v${version}/service`,
    service: {
      openapi: true
    },
    plugins
  }

  if (!isRuntimeContext) {
    config.server = {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    }
  }

  if (typescript === true) {
    config.plugins.typescript = `{PLT_${envPrefix}TYPESCRIPT}`
  }

  return config
}

function generateEnv (isRuntimeContext, hostname, port, typescript, envPrefix) {
  let env = ''

  if (!isRuntimeContext) {
    env += `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
`
  }

  if (typescript === true) {
    env += `\

# Set to false to disable automatic typescript compilation.
# Changing this setting is needed for production
PLT_${envPrefix}TYPESCRIPT=true
`
  }

  return env
}

async function createService (params, logger, currentDir = process.cwd(), version) {
  const {
    isRuntimeContext,
    hostname,
    port,
    typescript = false,
    staticWorkspaceGitHubAction,
    dynamicWorkspaceGitHubAction,
    runtimeContext,
    initGitRepository
  } = params

  const serviceEnv = {
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
  if (typescript) {
    serviceEnv.PLT_TYPESCRIPT = true
  }

  if (!version) {
    const pkg = await readFile(desm.join(import.meta.url, '..', '..', 'package.json'))
    version = JSON.parse(pkg).version
  }
  const envPrefix = runtimeContext !== undefined ? `${runtimeContext.envPrefix}_` : ''
  const config = generateConfig(isRuntimeContext, version, typescript, envPrefix)
  await writeFile(join(currentDir, 'platformatic.service.json'), JSON.stringify(config, null, 2))
  logger.info('Configuration file platformatic.service.json successfully created.')

  const env = generateEnv(isRuntimeContext, hostname, port, typescript, envPrefix)
  await appendFile(join(currentDir, '.env'), env)
  await writeFile(join(currentDir, '.env.sample'), env)
  logger.info('Environment file .env found, appending new environment variables to existing .env file.')

  if (typescript === true) {
    const tsConfigFileName = join(currentDir, 'tsconfig.json')
    const tsConfig = getTsConfig(TS_OUT_DIR)
    await writeFile(tsConfigFileName, JSON.stringify(tsConfig, null, 2))
    logger.info(
      `Typescript configuration file ${tsConfigFileName} successfully created.`
    )
  }

  if (!isRuntimeContext) {
    if (staticWorkspaceGitHubAction) {
      await createStaticWorkspaceGHAction(logger, serviceEnv, './platformatic.service.json', currentDir, typescript)
    }
    if (dynamicWorkspaceGitHubAction) {
      await createDynamicWorkspaceGHAction(logger, serviceEnv, './platformatic.service.json', currentDir, typescript)
    }
  }

  await generatePlugins(logger, currentDir, typescript, 'service')

  if (isRuntimeContext) {
    return addPrefixToEnv(serviceEnv, runtimeContext.envPrefix)
  }
  if (initGitRepository) {
    await createGitRepository(logger, currentDir)
  }
  return serviceEnv
}

export default createService
