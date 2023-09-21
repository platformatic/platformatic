'use strict'

const { readFile } = require('node:fs/promises')
const Ajv = require('ajv')
const openApiConfigSchema = require('./openapi-config-schema')
const errors = require('./errors')

const ajv = new Ajv()
const ajvValidate = ajv.compile(openApiConfigSchema)

async function loadOpenApiConfig (pathToConfig) {
  const openApiConfigFile = await readFile(pathToConfig, 'utf-8')
  const openApiConfig = JSON.parse(openApiConfigFile)

  if (!ajvValidate(openApiConfig)) {
    const validationErrors = ajvValidate.errors.map((err) => {
      return {
        /* c8 ignore next 1 */
        path: err.instancePath === '' ? '/' : err.instancePath,
        message: err.message + ' ' + JSON.stringify(err.params)
      }
    })
    throw new errors.ValidationErrors(validationErrors.map((err) => {
      return err.message
    }).join('\n'))
  }

  return openApiConfig
}

module.exports = loadOpenApiConfig
