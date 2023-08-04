import { writeFile, readFile, appendFile } from 'fs/promises'
import { join } from 'path'
import * as desm from 'desm'
import { findServiceConfigFile, isFileAccessible } from '../utils.mjs'
import { getTsConfig } from '../get-tsconfig.mjs'
import { generatePlugins } from '../create-plugins.mjs'

const TS_OUT_DIR = 'dist'

function generateConfig (version, typescript) {
  const plugins = {
    paths: [
      { path: './plugins', encapsulate: false },
      './routes'
    ]
  }

  const config = {
    $schema: `https://platformatic.dev/schemas/v${version}/service`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    service: {
      openapi: true
    },
    plugins
  }

  if (typescript === true) {
    config.plugins.typescript = '{PLT_TYPESCRIPT}'
  }

  return config
}

function generateEnv (hostname, port, typescript) {
  let env = `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
`

  if (typescript === true) {
    env += `\

# Set to false to disable automatic typescript compilation.
# Changing this setting is needed for production
PLT_TYPESCRIPT=true
`
  }

  return env
}

async function createService ({ hostname, port, typescript = false }, logger, currentDir = process.cwd(), version) {
  if (!version) {
    const pkg = await readFile(desm.join(import.meta.url, '..', '..', 'package.json'))
    version = JSON.parse(pkg).version
  }
  const accessibleConfigFilename = await findServiceConfigFile(currentDir)

  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(version, typescript)
    await writeFile(join(currentDir, 'platformatic.service.json'), JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.service.json successfully created.')

    const env = generateEnv(hostname, port, typescript)
    const envFileExists = await isFileAccessible('.env', currentDir)
    await appendFile(join(currentDir, '.env'), env)
    await writeFile(join(currentDir, '.env.sample'), env)
    /* c8 ignore next 5 */
    if (envFileExists) {
      logger.info('Environment file .env found, appending new environment variables to existing .env file.')
    } else {
      logger.info('Environment file .env successfully created.')
    }
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  if (typescript === true) {
    const tsConfigFileName = join(currentDir, 'tsconfig.json')
    const isTsConfigExists = await isFileAccessible(tsConfigFileName)
    if (!isTsConfigExists) {
      const tsConfig = getTsConfig(TS_OUT_DIR)
      await writeFile(tsConfigFileName, JSON.stringify(tsConfig, null, 2))
      logger.info(
        `Typescript configuration file ${tsConfigFileName} successfully created.`
      )
    } else {
      logger.info(
        `Typescript configuration file ${tsConfigFileName} found, skipping creation of typescript configuration file.`
      )
    }
  }

  await generatePlugins(logger, currentDir, typescript, 'service')

  return {
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
}

export default createService
