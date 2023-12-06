'use strict'

const { access } = require('node:fs/promises')
const { resolve, join, relative, dirname, basename } = require('node:path')
const { isatty } = require('tty')

async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

/* c8 ignore start */
function addLoggerToTheConfig (config) {
  // We might have a config with no server
  if (!config.server) {
    config.server = {}
  }
  // Set the logger if not present
  let logger = config.server.logger
  if (!logger) {
    config.server.logger = { level: 'info' }
    logger = config.server.logger
  }

  // If TTY use pino-pretty
  if (isatty(1)) {
    if (!logger.transport) {
      logger.transport = {
        target: 'pino-pretty'
      }
    }
  }
}
/* c8 ignore stop */

function getJSPluginPath (workingDir, tsPluginPath, compileDir) {
  if (tsPluginPath.endsWith('js')) {
    return tsPluginPath
  }

  if (tsPluginPath.indexOf(compileDir) === 0) {
    // In this case, we passed through this function before and we have adjusted
    // the path of the plugin to point to the dist/ folder. Then we restarted.
    // Therefore, we can just return the path as is.
    return tsPluginPath
  }

  const isTs = tsPluginPath.endsWith('ts')
  let newBaseName

  // TODO: investigate why c8 does not see those
  /* c8 ignore next 5 */
  if (isTs) {
    newBaseName = basename(tsPluginPath, '.ts') + '.js'
  } else {
    newBaseName = basename(tsPluginPath)
  }

  const tsPluginRelativePath = relative(workingDir, tsPluginPath)
  const jsPluginRelativePath = join(
    dirname(tsPluginRelativePath),
    newBaseName
  )

  return join(compileDir, jsPluginRelativePath)
}

function convertOpenApiToFastifyPath (openApiPath) {
  return openApiPath
    .replace(/{wildcard}/g, '*')
    .replace(/{(\w+)}/g, ':$1')
}

function updateOpenApiSchemaRefs (openapiSchema) {
  const componentsPrefix = '#/components/schemas/'

  for (const key of Object.keys(openapiSchema)) {
    const value = openapiSchema[key]

    if (key === '$ref' && value.startsWith(componentsPrefix)) {
      openapiSchema.$ref = value
        .replace(componentsPrefix, '')
        .split('/', 1)
        .join('#/')

      continue
    }

    if (typeof value === 'object') {
      updateOpenApiSchemaRefs(value)
    }
  }
}

function convertOpenApiToFastifyRouteSchema (openapiSchema) {
  const routeSchema = {}

  for (const openApiParam of openapiSchema.parameters ?? []) {
    const name = openApiParam.name
    const schema = openApiParam.schema

    if (openApiParam.in === 'path') {
      if (routeSchema.params === undefined) {
        routeSchema.params = {
          type: 'object',
          properties: {},
          required: []
        }
      }

      routeSchema.params.properties[name] = schema
      if (openApiParam.required) {
        routeSchema.params.required.push(name)
      }
    }

    if (openApiParam.in === 'header') {
      if (routeSchema.headers === undefined) {
        routeSchema.headers = {
          type: 'object',
          properties: {},
          required: []
        }
      }

      routeSchema.headers.properties[name] = schema
      if (openApiParam.required) {
        routeSchema.headers.required.push(name)
      }
    }

    if (openApiParam.in === 'query') {
      if (routeSchema.querystring === undefined) {
        routeSchema.querystring = {
          type: 'object',
          properties: {},
          required: []
        }
      }

      routeSchema.querystring.properties[name] = schema
      if (openApiParam.required) {
        routeSchema.querystring.required.push(name)
      }
    }
  }

  if (openapiSchema.requestBody) {
    const content = openapiSchema.requestBody.content
    const contentType = Object.keys(content)[0]
    routeSchema.body = content[contentType].schema
  }

  for (const statusCode of Object.keys(openapiSchema.responses ?? {})) {
    const response = openapiSchema.responses[statusCode]
    const responseSchema = response.content?.['application/json']?.schema
    if (responseSchema) {
      if (!routeSchema.response) {
        routeSchema.response = {}
      }
      routeSchema.response[statusCode] = responseSchema
    }
  }

  updateOpenApiSchemaRefs(routeSchema)

  return routeSchema
}

function changeOpenapiSchemaPrefix (openapiSchema, oldVersionPrefix, newVersionPrefix) {
  if (!oldVersionPrefix && !newVersionPrefix) return openapiSchema

  const normalizedPaths = {}
  for (const oldPath of Object.keys(openapiSchema.paths ?? {})) {
    const newPath = oldVersionPrefix
      ? oldPath.replace(oldVersionPrefix, newVersionPrefix)
      : newVersionPrefix + oldPath

    normalizedPaths[newPath] = openapiSchema.paths[oldPath]
  }

  return {
    ...openapiSchema,
    paths: normalizedPaths
  }
}

module.exports = {
  isFileAccessible,
  getJSPluginPath,
  addLoggerToTheConfig,
  changeOpenapiSchemaPrefix,
  convertOpenApiToFastifyPath,
  convertOpenApiToFastifyRouteSchema
}
