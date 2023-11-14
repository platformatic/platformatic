import { writeFile } from 'node:fs/promises'

import pino from 'pino'
import pretty from 'pino-pretty'
import { request } from 'undici'

import { loadConfig } from '@platformatic/config'
import { platformaticComposer } from '../index.js'
import errors from '../lib/errors.js'
import { prefixWithSlash } from './utils.js'

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

export default async function fetchOpenApiSchemas (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager } = await loadConfig({}, _args, platformaticComposer)
  await configManager.parseAndValidate()
  const config = configManager.current
  const { services } = config.composer

  const servicesWithValidOpenApi = services
    .filter(({ openapi }) => openapi && openapi.url && openapi.file)

  const fetchOpenApiRequests = servicesWithValidOpenApi
    .map(service => fetchOpenApiSchema(service))

  const fetchOpenApiResults = await Promise.allSettled(fetchOpenApiRequests)
  fetchOpenApiResults.forEach((result, index) => {
    const serviceId = servicesWithValidOpenApi[index].id
    if (result.status === 'rejected') {
      logger.error(`Failed to fetch OpenAPI schema for service with id ${serviceId}: ${result.reason}`)
    } else {
      logger.info(`Successfully fetched OpenAPI schema for service with id ${serviceId}`)
    }
  })
}

export {
  fetchOpenApiSchema,
  fetchOpenApiSchemas
}
