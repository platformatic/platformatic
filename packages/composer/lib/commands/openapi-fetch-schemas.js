'use strict'

const { writeFile } = require('node:fs/promises')
const { createRequire } = require('node:module')
const { request } = require('undici')
const { loadConfig } = require('@platformatic/config')
const { loadModule } = require('@platformatic/utils')
const errors = require('../errors.js')
const { prefixWithSlash } = require('../utils.js')

async function fetchOpenApiSchema (service) {
  const { origin, openapi } = service

  const openApiUrl = origin + prefixWithSlash(openapi.url)
  const { statusCode, body } = await request(openApiUrl)

  if (statusCode !== 200 && statusCode !== 201) {
    throw new errors.FailedToFetchOpenAPISchemaError(openApiUrl)
  }
  const schema = await body.json()

  if (openapi.file !== undefined) {
    await writeFile(openapi.file, JSON.stringify(schema, null, 2))
  }

  return schema
}

async function fetchOpenApiSchemas (logger, configFile, _args, { colorette }) {
  const { bold } = colorette
  const platformaticComposer = await loadModule(createRequire(__filename), '../../index.js')
  const { configManager } = await loadConfig({}, ['-c', configFile], platformaticComposer)
  await configManager.parseAndValidate()
  const config = configManager.current
  const { services } = config.composer

  const servicesWithValidOpenApi = services.filter(({ openapi }) => openapi && openapi.url && openapi.file)

  const fetchOpenApiRequests = servicesWithValidOpenApi.map(service => fetchOpenApiSchema(service))

  const fetchOpenApiResults = await Promise.allSettled(fetchOpenApiRequests)

  logger.info('Fetching schemas for all services.')

  fetchOpenApiResults.forEach((result, index) => {
    const serviceId = servicesWithValidOpenApi[index].id
    if (result.status === 'rejected') {
      logger.error(`Failed to fetch OpenAPI schema for service with id ${bold(serviceId)}: ${result.reason}`)
    } else {
      logger.info(`Successfully fetched OpenAPI schema for service with id ${bold(serviceId)}`)
    }
  })
}

module.exports = { fetchOpenApiSchema, fetchOpenApiSchemas }
