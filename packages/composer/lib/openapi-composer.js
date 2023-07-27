'use strict'

const clone = require('rfdc')()

function composeOpenApi (apis, options = {}) {
  const mergedPaths = {}
  const mergedSchemas = {}

  for (const { id, prefix, schema } of apis) {
    const { paths, components } = clone(schema)

    const apiPrefix = generateOperationIdApiPrefix(id)
    for (const [path, pathSchema] of Object.entries(paths)) {
      namespaceSchemaRefs(apiPrefix, pathSchema)
      namespaceSchemaOperationIds(apiPrefix, pathSchema)

      const mergedPath = prefix ? prefix + path : path

      if (mergedPaths[mergedPath]) {
        throw new Error('Path "' + mergedPath + '" already exists')
      }
      mergedPaths[mergedPath] = pathSchema
    }

    if (components && components.schemas) {
      for (const [schemaKey, schema] of Object.entries(components.schemas)) {
        if (schema.title == null) {
          schema.title = schemaKey
        }
        namespaceSchemaRefs(apiPrefix, schema)
        mergedSchemas[apiPrefix + schemaKey] = schema
      }
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: options.title || 'Platformatic Composer',
      version: options.version || '1.0.0'
    },
    components: {
      schemas: mergedSchemas
    },
    paths: mergedPaths
  }
}

function generateOperationIdApiPrefix (operationId) {
  return operationId.trim()
    .replace(/[^A-Z0-9]+/ig, '_')
    .replace(/^_+|_+$/g, '') + '_'
}

function namespaceSchemaRefs (apiPrefix, schema) {
  if (schema.$ref && schema.$ref.startsWith('#/components/schemas')) {
    schema.$ref = schema.$ref.replace(
      '#/components/schemas/',
      '#/components/schemas/' + apiPrefix
    )
  }
  for (const childSchema of Object.values(schema)) {
    if (typeof childSchema === 'object') {
      namespaceSchemaRefs(apiPrefix, childSchema)
    }
  }
}

function namespaceSchemaOperationIds (apiPrefix, schema) {
  if (schema.operationId) {
    schema.operationId = apiPrefix + schema.operationId
  }
  for (const childSchema of Object.values(schema)) {
    if (typeof childSchema === 'object') {
      namespaceSchemaOperationIds(apiPrefix, childSchema)
    }
  }
}

module.exports = composeOpenApi
