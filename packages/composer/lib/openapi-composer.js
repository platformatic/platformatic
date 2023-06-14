'use strict'

const clone = require('rfdc')()

function composeOpenApi (apis, options = {}) {
  const mergedPaths = {}
  const mergedSchemas = {}

  for (const { id, prefix, ignore, schema } of apis) {
    const { paths, components } = clone(schema)

    const ignoreMethods = {}
    for (const ignoreRule of ignore || []) {
      if (typeof ignoreRule === 'string') {
        ignoreMethods[ignoreRule] = true
        continue
      }
      if (!ignoreRule.methods) {
        ignoreMethods[ignoreRule.path] = true
        continue
      }
      ignoreMethods[ignoreRule.path] = ignoreRule.methods.map(
        (method) => method.toLowerCase()
      )
    }

    const apiPrefix = id + '_'
    for (const [path, pathSchema] of Object.entries(paths)) {
      const pathIgnoreMethods = ignoreMethods[path]

      if (pathIgnoreMethods !== undefined) {
        if (pathIgnoreMethods === true) continue

        for (let method of Object.keys(pathSchema)) {
          method = method.toLowerCase()
          if (pathIgnoreMethods.includes(method)) {
            delete pathSchema[method]
          }
          if (Object.keys(pathSchema).length === 0) continue
        }
      }

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
