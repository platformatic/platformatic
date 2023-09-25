import { readFile, readdir, unlink, writeFile } from 'fs/promises'
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

  await cleanServicesConfig(logger, servicesDir, entrypoint)

  await manageServicesEnvFiles(servicesDir, currentDir, entrypoint)
  return {}
}
/**
 *
 * @param {string} servicesDir the services dir
 * @param {string | null} entrypoint the entrypoint. If specified the function will filter it out
 * @returns {Promise}
 */
async function getAllServices (servicesDir, entrypoint = null) {
  const services = (await readdir(servicesDir))
  if (entrypoint) {
    return services.filter(dir => dir !== entrypoint)
  }
  return services
}
async function cleanServicesConfig (logger, servicesDir, entrypoint) {
  const services = await getAllServices(servicesDir, entrypoint)
  for (const svc of services) {
    const serviceDir = join(servicesDir, svc)
    const configFile = await findConfigFile(serviceDir)
    if (!configFile) {
      logger.warn(`Cannot find config file in ${serviceDir}`)
    } else {
      console.log(`Found config file ${configFile}`)
      const configFilePath = join(serviceDir, configFile)
      const config = JSON.parse(await readFile(configFilePath, 'utf8'))
      delete config.server
      await writeFile(configFilePath, JSON.stringify(config, null, 2))
    }
  }
}

async function manageServicesEnvFiles (servicesDir, runtimeDir, entrypoint) {
  // read main env file

  // let mainEnvFile = await readFile(join(runtimeDir, '.env'), 'utf8')
  let mainEnvFile = ''
  const services = await getAllServices(servicesDir)
  for (const svc of services) {
    const envFile = await readFile(join(servicesDir, svc, '.env'), 'utf8')
    if (svc === entrypoint) {
      // copy the whole file
      mainEnvFile += `\n${envFile}`
    } else {
      // read .env file
      const lines = envFile.split('\n')
      lines.forEach((line) => {
        // copy to main env file only if line _doesn't_ match
        // i.e any other config or comments
        if (!line.match(/(PLT_LOGGER_LEVEL|PORT|PLT_SERVER_HOSTNAME)=/)) {
          mainEnvFile += `\n${line}`
        }
      })
    }
    try {
      await unlink(join(servicesDir, svc, '.env.sample'))
    } catch (err) {
      // do nothing
    }
  }
  await writeFile(join(runtimeDir, '.env'), mainEnvFile)
}

async function findConfigFile (dir) {
  const allFiles = await readdir(dir)
  return allFiles.find((file) => {
    return file.match(/platformatic\.(.*)\.json/)
  })
}

export default createRuntime
