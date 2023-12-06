'use strict'

const { join, relative } = require('node:path')
const { mkdir, readFile, writeFile } = require('node:fs/promises')
const pino = require('pino')
const pretty = require('pino-pretty')
const { loadConfig } = require('@platformatic/config')
const { analyze, write: writeConfig } = require('@platformatic/metaconfig')
const { platformaticService } = require('../index.js')
const { getOpenapiSchema } = require('./get-openapi-schema.js')
const { createMappersPlugins } = require('./update-version.js')
const { changeOpenapiSchemaPrefix } = require('./utils')
const errors = require('./errors.js')

async function execute ({
  logger,
  configManager,
  version,
  prefix,
  userApiKey,
  openai,
  openaiProxyHost
}) {
  const config = configManager.current

  const metaConfig = await analyze({ file: configManager.fullPath })
  const rawConfig = metaConfig.config

  const versionsDirName = 'versions'
  const versionsDirPath = config.versions?.dir ??
    join(configManager.dirname, versionsDirName)

  let versionsConfigs = config.versions
  let rawVersionsConfigs = rawConfig.versions

  if (!config.versions) {
    versionsConfigs = { dir: versionsDirName, configs: [] }
    rawVersionsConfigs = { dir: versionsDirName, configs: [] }
  }

  let biggestVersion = 0
  for (const versionConfig of versionsConfigs.configs) {
    if (versionConfig.version === version) {
      throw new errors.VersionAlreadyExists(version)
    }
    const versionNumber = parseInt(versionConfig.version.slice(1))
    if (!isNaN(versionNumber)) {
      biggestVersion = Math.max(biggestVersion, versionNumber)
    }
  }
  version = version ?? `v${biggestVersion + 1}`
  prefix = prefix ?? `/${version}`
  prefix = prefix.charAt(0) === '/' ? prefix : `/${prefix}`

  const versionDir = join(versionsDirPath, version)
  await mkdir(versionDir, { recursive: true })

  const latestVersionConfig = versionsConfigs.configs.at(-1)
  const rawLatestVersionConfig = rawVersionsConfigs.configs.at(-1)

  const latestVersion = latestVersionConfig?.version ?? null
  const latestVersionPrefix = latestVersionConfig?.openapi?.prefix ?? ''

  logger.info('Loading the latest openapi schema.')
  const latestOpenapiSchema = await getOpenapiSchema({
    logger,
    configManager,
    version: latestVersion
  })

  const newOpenapiSchema = changeOpenapiSchemaPrefix(
    latestOpenapiSchema,
    latestVersionPrefix,
    prefix
  )
  const newOpenapiSchemaPath = join(versionDir, 'openapi.json')

  logger.info(`Writing "${version}" openapi schema file.`)
  await writeFile(newOpenapiSchemaPath, JSON.stringify(newOpenapiSchema, null, 2))

  const newVersionConfig = {
    version,
    openapi: {
      path: relative(configManager.dirname, newOpenapiSchemaPath),
      prefix
    }
  }

  if (latestVersionConfig) {
    newVersionConfig.plugins = rawLatestVersionConfig.plugins
    delete latestVersionConfig.plugins
    delete rawLatestVersionConfig.plugins
  } else if (config.plugins) {
    newVersionConfig.plugins = rawConfig.plugins
    delete config.plugins
    delete rawConfig.plugins
  }

  versionsConfigs.configs.push(newVersionConfig)
  rawVersionsConfigs.configs.push(newVersionConfig)

  config.versions = versionsConfigs
  rawConfig.versions = rawVersionsConfigs

  await Promise.all([configManager.update(), writeConfig(metaConfig)])

  if (latestVersionConfig) {
    logger.info(`Reading openapi schema for "${latestVersion}"`)
    const prevOpenapiSchemaPath = latestVersionConfig.openapi.path
    const prevOpenapiSchemaFile = await readFile(prevOpenapiSchemaPath, 'utf8')
    const prevOpenapiSchema = JSON.parse(prevOpenapiSchemaFile)

    await createMappersPlugins({
      logger,
      configManager,
      prevVersion: latestVersion,
      nextVersion: version,
      prevOpenapiSchema,
      nextOpenapiSchema: newOpenapiSchema,
      userApiKey,
      openai,
      openaiProxyHost
    })
  }
}

async function bumpVersion (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  try {
    const { configManager, args } = await loadConfig({
      string: ['version', 'prefix', 'openai-proxy-host', 'user-api-key'],
      boolean: ['openai'],
      alias: {
        v: 'version',
        p: 'prefix'
      }
    }, _args, platformaticService)
    await configManager.parseAndValidate()

    const version = args.version
    const prefix = args.prefix

    const openai = args.openai ?? false
    const openaiProxyHost = args['openai-proxy-host'] ?? null

    let userApiKey = args['user-api-key'] ?? null
    /* c8 ignore next 10 */
    if (!userApiKey && openai) {
      logger.info('Reading platformatic user api key')
      const { getUserApiKey } = await import('@platformatic/authenticate')
      try {
        userApiKey = await getUserApiKey()
      } catch (err) {
        logger.error('Failed to read user api key. Please run "plt login" command.')
        return
      }
    }

    await execute({
      logger,
      configManager,
      version,
      prefix,
      userApiKey,
      openai,
      openaiProxyHost
    })
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}

module.exports = { bumpVersion, execute }
