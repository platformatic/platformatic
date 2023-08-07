import { readFile, writeFile, appendFile } from 'fs/promises'
import { findComposerConfigFile, isFileAccessible, purgeEnvString } from '../utils.mjs'
import { join } from 'path'
import * as desm from 'desm'

function generateConfig (version) {
  const config = {
    $schema: `https://platformatic.dev/schemas/v${version}/composer`,
    server: {
      hostname: '{PLT_SERVER_HOSTNAME}',
      port: '{PORT}',
      logger: {
        level: '{PLT_SERVER_LOGGER_LEVEL}'
      }
    },
    composer: {
      services: [{
        id: 'example',
        origin: '{PLT_EXAMPLE_ORIGIN}',
        openapi: {
          url: '/documentation/json'
        }
      }],
      refreshTimeout: 1000
    },
    watch: true
  }

  return config
}

function generateEnv (hostname, port) {
  const env = `\
PLT_SERVER_HOSTNAME=${hostname}
PORT=${port}
PLT_SERVER_LOGGER_LEVEL=info
PLT_EXAMPLE_ORIGIN=
`

  return env
}

async function createComposer ({ hostname, port }, logger, currentDir = process.cwd(), version) {
  if (!version) {
    const pkg = await readFile(desm.join(import.meta.url, '..', '..', 'package.json'))
    version = JSON.parse(pkg).version
  }
  const accessibleConfigFilename = await findComposerConfigFile(currentDir)

  if (accessibleConfigFilename === undefined) {
    const config = generateConfig(version)
    await writeFile(join(currentDir, 'platformatic.composer.json'), JSON.stringify(config, null, 2))
    logger.info('Configuration file platformatic.composer.json successfully created.')

    const env = generateEnv(hostname, port)
    const envFileExists = await isFileAccessible('.env', currentDir)
    await appendFile(join(currentDir, '.env'), env)
    await writeFile(join(currentDir, '.env.sample'), purgeEnvString(env))
    /* c8 ignore next 5 */
    if (envFileExists) {
      logger.info('Environment file .env found, appending new environment variables to existing .env file.')
    } else {
      logger.info('Environment file .env successfully created.')
    }
  } else {
    logger.info(`Configuration file ${accessibleConfigFilename} found, skipping creation of configuration file.`)
  }

  return {
    PLT_SERVER_LOGGER_LEVEL: 'info',
    PORT: port,
    PLT_SERVER_HOSTNAME: hostname
  }
}

export default createComposer
