const openApiPathItemNonOperationKeys = ['summary', 'description', 'servers', 'parameters']

function removeOperationPropertiesFromOpenApiPathItem (pathItem) {
  const pathItemKeys = new Set(Object.keys(pathItem))

  return openApiPathItemNonOperationKeys.reduce((acc, key) => {
    if (pathItemKeys.has(key)) {
      acc[key] = pathItem[key]
    }
    return acc
  }, {})
}

function getSchemaOverrideFromOpenApiPathItem (pathItem, method) {
  method = method?.toLowerCase()

  const schemaOverride = removeOperationPropertiesFromOpenApiPathItem(pathItem)

  if (!method || !pathItem[method]) {
    return schemaOverride
  }

  Object.keys(pathItem[method]).forEach((key) => {
    schemaOverride[key] = pathItem[method][key]
  })
  return schemaOverride
}

module.exports = {
  getSchemaOverrideFromOpenApiPathItem
}
