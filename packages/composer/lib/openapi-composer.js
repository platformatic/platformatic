import rfdc from 'rfdc'
import { PathAlreadyExistsError } from './errors.js'

const clone = rfdc()

function generateOperationIdApiPrefix (operationId) {
  return (
    operationId
      .trim()
      .replace(/[^A-Z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') + '_'
  )
}

function namespaceSchemaRefs (apiPrefix, schema) {
  if (schema.$ref && schema.$ref.startsWith('#/components/schemas')) {
    schema.$ref = schema.$ref.replace('#/components/schemas/', '#/components/schemas/' + apiPrefix)
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

export function composeOpenApi (apis, options = {}) {
  const mergedPaths = {}
  const mergedSchemas = {}
  const mergedSecuritySchemes = {}

  for (const { id, prefix, schema } of apis) {
    const { paths, components } = clone(schema)

    const apiPrefix = generateOperationIdApiPrefix(id)
    for (const [path, pathSchema] of Object.entries(paths)) {
      namespaceSchemaRefs(apiPrefix, pathSchema)
      namespaceSchemaOperationIds(apiPrefix, pathSchema)

      for (const methodSchema of Object.values(pathSchema)) {
        if (methodSchema.security) {
          methodSchema.security = methodSchema.security.map(security => {
            const newSecurity = {}
            for (const [securityKey, securityValue] of Object.entries(security)) {
              newSecurity[apiPrefix + securityKey] = securityValue
            }
            return newSecurity
          })
        }
      }

      const mergedPath = prefix ? prefix + path : path

      if (mergedPaths[mergedPath]) {
        throw new PathAlreadyExistsError(mergedPath)
      }
      mergedPaths[mergedPath] = pathSchema
    }

    if (components) {
      if (components.schemas) {
        for (const [schemaKey, schema] of Object.entries(components.schemas)) {
          if (schema.title == null) {
            schema.title = schemaKey
          }
          namespaceSchemaRefs(apiPrefix, schema)
          mergedSchemas[apiPrefix + schemaKey] = schema
        }
      }

      if (components.securitySchemes) {
        for (const [securitySchemeKey, securityScheme] of Object.entries(components.securitySchemes)) {
          mergedSecuritySchemes[apiPrefix + securitySchemeKey] = securityScheme
        }
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
      securitySchemes: mergedSecuritySchemes,
      schemas: mergedSchemas
    },
    paths: mergedPaths
  }
}
