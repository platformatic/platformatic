import { loadConfiguration } from '@platformatic/utils'
import { writeFile } from 'node:fs/promises'
import { request } from 'undici'
import { FailedToFetchOpenAPISchemaError } from '../errors.js'
import { schema } from '../schema.js'
import { prefixWithSlash } from '../utils.js'

export async function fetchOpenApiSchema (service) {
  const { origin, openapi } = service

  const openApiUrl = origin + prefixWithSlash(openapi.url)
  const { statusCode, body } = await request(openApiUrl)

  if (statusCode !== 200 && statusCode !== 201) {
    throw new FailedToFetchOpenAPISchemaError(openApiUrl)
  }
  const schema = await body.json()

  if (openapi.file !== undefined) {
    await writeFile(openapi.file, JSON.stringify(schema, null, 2))
  }

  return schema
}

export async function fetchOpenApiSchemas (logger, configFile, _args, { colorette }) {
  const { bold } = colorette
  const config = await loadConfiguration(configFile, schema)
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
