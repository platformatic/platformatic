import { loadConfiguration } from '@platformatic/foundation'
import { writeFile } from 'node:fs/promises'
import { request } from 'undici'
import { FailedToFetchOpenAPISchemaError } from '../errors.js'
import { schema } from '../schema.js'
import { upgrade } from '../upgrade.js'
import { prefixWithSlash } from '../utils.js'

export async function fetchOpenApiSchema (application) {
  const { origin, openapi } = application

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
  const config = await loadConfiguration(configFile, schema, { upgrade })
  const { applications } = config.composer

  const applicationsWithValidOpenApi = applications.filter(({ openapi }) => openapi && openapi.url && openapi.file)

  const fetchOpenApiRequests = applicationsWithValidOpenApi.map(application => fetchOpenApiSchema(application))

  const fetchOpenApiResults = await Promise.allSettled(fetchOpenApiRequests)

  logger.info('Fetching schemas for all applications.')

  fetchOpenApiResults.forEach((result, index) => {
    const applicationId = applicationsWithValidOpenApi[index].id
    if (result.status === 'rejected') {
      logger.error(`Failed to fetch OpenAPI schema for application with id ${bold(applicationId)}: ${result.reason}`)
    } else {
      logger.info(`Successfully fetched OpenAPI schema for application with id ${bold(applicationId)}`)
    }
  })
}
