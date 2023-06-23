'use strict'

const traverse = require('json-schema-traverse')
const clone = require('rfdc')()

const MODIFICATION_KEYWORDS = ['rename']

function findDataBySchemaPointer (schemaPointer, schema, data, callback) {
  const schemaPointerParts = schemaPointer.split('/').slice(1)

  let parentData = null
  for (const schemaPointerPart of schemaPointerParts) {
    if (
      schemaPointerPart === 'properties' ||
      schemaPointerPart === 'additionalProperties' ||
      schemaPointerPart === 'patternProperties'
    ) continue

    parentData = data
    data = data[schemaPointerPart]
  }

  callback(data, parentData)
}

function getModificationRules (modificationSchema) {
  const modificationRules = {}

  function getModificationRules (schema, jsonPointer) {
    const schemaKeys = Object.keys(schema)
    const modificationKeys = schemaKeys.filter(
      key => MODIFICATION_KEYWORDS.includes(key)
    )

    if (modificationKeys.length === 0) return
    modificationRules[jsonPointer] = schema
  }

  traverse(modificationSchema, { cb: getModificationRules })
  return modificationRules
}

function modifySchema (originSchema, modificationRules) {
  function modifyOriginSchema (schema, jsonPointer, rs, psp, pk, parentSchema, keyIndex) {
    const modificationRule = modificationRules[jsonPointer]
    if (!modificationRule) return

    if (modificationRule.rename) {
      parentSchema.properties[modificationRule.rename] = schema
      delete parentSchema.properties[keyIndex]
    }
  }
  traverse(originSchema, { cb: modifyOriginSchema })
}

function modifyPayload (payload, originSchema, modificationRules) {
  for (const schemaJsonPointer in modificationRules) {
    const rule = modificationRules[schemaJsonPointer]

    findDataBySchemaPointer(
      schemaJsonPointer,
      originSchema,
      payload,
      (data, parentData) => {
        if (rule.rename) {
          parentData[rule.rename] = data
          delete parentData[schemaJsonPointer.split('/').pop()]
        }
      }
    )
  }
}

function modifyOpenSchema (app, api) {
  const newSchemaPaths = {}

  const { schema, config } = api
  const { paths } = clone(schema)

  for (const path in paths) {
    const pathConfig = config?.paths?.[path]
    if (pathConfig?.ignore) continue

    const pathSchema = paths[path]
    for (const method in pathSchema) {
      const routeSchema = pathSchema[method]
      const routeConfig = pathConfig?.[method.toLowerCase()]

      if (routeConfig?.ignore) {
        delete pathSchema[method]
        continue
      }

      const responseSchema = routeSchema.responses?.['200']?.content?.['application/json']?.schema
      const modificationResponseSchema = routeConfig?.responses?.['200']
      if (!responseSchema || !modificationResponseSchema) continue

      const modificationRules = getModificationRules(modificationResponseSchema)
      modifySchema(responseSchema, modificationRules)

      app.platformatic.addComposerOnRouteHook(path, [method], routeOptions => {
        async function onComposerResponse (request, reply, body) {
          const payload = await body.json()
          modifyPayload(payload, responseSchema, modificationRules)
          reply.send(payload)
        }
        routeOptions.config.onComposerResponse = onComposerResponse
      })
    }
    if (Object.keys(pathSchema).length === 0) continue
    newSchemaPaths[path] = pathSchema
  }

  return { ...schema, paths: newSchemaPaths }
}

module.exports = modifyOpenSchema
