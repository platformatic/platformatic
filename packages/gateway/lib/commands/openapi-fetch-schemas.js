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

export async function fetchOpenApiSchemas (logger, configuration, _args, context) {
  const { bold } = context.colorette

  /*
    v4 hands a command the application's already-resolved configuration as data: the loader
    evaluated it once, main-side, and validated it against this capability's schema. `resolved`
    says the reading is done, so what happens here is the transform and nothing else.

    Passing a path is still supported and still does the full read, which is what a caller outside
    a running project supplies.
  */
  const config =
    typeof configuration === 'string'
      ? await loadConfiguration(configuration, schema, { upgrade })
      : await loadConfiguration(configuration, schema, {
        resolved: true,
        root: context?.application?.path ?? process.cwd()
      })
  const { applications } = config.gateway

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
