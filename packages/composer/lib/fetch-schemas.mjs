import { writeFile } from 'node:fs/promises'

import pino from 'pino'
import pretty from 'pino-pretty'
import { request } from 'undici'

import { loadConfig } from '@platformatic/config'
import { platformaticComposer } from '../index.js'

async function fetchOpenApiSchema (service) {
  const { origin, openapi } = service

  const openApiUrl = origin + openapi.url
  const { statusCode, body } = await request(openApiUrl)

  if (statusCode !== 200 && statusCode !== 201) {
    throw new Error(`Failed to fetch OpenAPI schema from ${openApiUrl}`)
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

  try {
    const { configManager } = await loadConfig({}, _args, platformaticComposer)
    await configManager.parseAndValidate()
    const config = configManager.current

    const fetchOpenApiRequests = config.composer.services
      .filter(({ openapi }) => openapi && openapi.url && openapi.file)
      .map(service => fetchOpenApiSchema(service))

    // TODO: replace with allSettled
    await Promise.all(fetchOpenApiRequests)

    logger.info('OpenAPI schemas successfully fetched')
  } catch (error) {
    logger.error(error.message)
    process.exit(1)
  }
}

export {
  fetchOpenApiSchema,
  fetchOpenApiSchemas
}
