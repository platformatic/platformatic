'use strict'

const { printAndExitLoadConfigError } = require('@platformatic/config')
const { buildServer } = require('./start')
const { platformaticService } = require('../index.js')

async function getOpenapiSchema ({ logger, configManager, version }) {
  const config = configManager.current

  let app = null
  try {
    app = await buildServer({ ...config, configManager }, platformaticService)
    await app.ready()
  /* c8 ignore next 4 */
  } catch (err) {
    printAndExitLoadConfigError(err)
    process.exit(1)
  }

  if (!version) {
    return app.swagger()
  }

  if (!config.versions) {
    throw new Error('No versions configured')
  }

  const versionsConfigs = config.versions.configs ?? []
  const versionConfig = versionsConfigs.find(v => v.version === version)
  const versionPrefix = versionConfig.openapi.prefix ?? ''

  const openapiUrl = versionPrefix
    ? versionPrefix + '/documentation/json'
    : '/documentation/json'

  const { statusCode, body } = await app.inject({ method: 'GET', url: openapiUrl })

  /* c8 ignore next 3 */
  if (statusCode !== 200) {
    throw new Error(`Failed to get openapi schema for version ${version}`)
  }

  const openapiSchema = JSON.parse(body)
  return openapiSchema
}

module.exports = { getOpenapiSchema }
