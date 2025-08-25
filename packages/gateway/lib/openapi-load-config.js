import Ajv from 'ajv'
import { readFile } from 'node:fs/promises'
import { ValidationErrors } from './errors.js'
import { openApiConfigSchema } from './openapi-config-schema.js'

const ajv = new Ajv()
const ajvValidate = ajv.compile(openApiConfigSchema)

export async function loadOpenApiConfig (pathToConfig) {
  const openApiConfigFile = await readFile(pathToConfig, 'utf-8')
  const openApiConfig = JSON.parse(openApiConfigFile)

  if (!ajvValidate(openApiConfig)) {
    const validationErrors = ajvValidate.errors.map(err => {
      return {
        /* c8 ignore next 1 */
        path: err.instancePath === '' ? '/' : err.instancePath,
        message: err.message + ' ' + JSON.stringify(err.params)
      }
    })
    throw new ValidationErrors(
      validationErrors
        .map(err => {
          return err.message
        })
        .join('\n')
    )
  }

  return openApiConfig
}
