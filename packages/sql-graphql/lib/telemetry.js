'use strict'

const telemetryWrapper = (app, fn, operationType, operationName) => async (...args) => {
  const { startInternalSpan, endInternalSpan } = app.openTelemetry
  const context = args[2]
  const request = context?.reply?.request
  const document = JSON.stringify(request?.body)

  // GraphQL semantic conventions, see: https://github.com/open-telemetry/semantic-conventions/blob/main/docs/database/graphql.md#semantic-conventions-for-graphql-server
  const telemetryAttributes = {
    'graphql.document': document,
    'graphql.operation.name': operationName,
    'graphql.operation.type': operationType
  }
  const spanName = `${operationType} ${operationName}`
  const ctx = request.span?.context

  const span = startInternalSpan(spanName, ctx, telemetryAttributes)
  try {
    const result = await fn(...args)
    endInternalSpan(span)
    return result
  // We ignore this because in sqlite it's HARD to have a resolver exception without a schema validation exception first.
  } catch (err) /* istanbul ignore next */ {
    endInternalSpan(span, err)
    throw err
  }
}

const setupTelemetry = app => {
  /* istanbul ignore next */
  if (!app || !app.graphql) {
    app.log.warn('No graphql plugin found, skipping telemetry setup')
    return
  }
  const schema = app.graphql.schema
  /* istanbul ignore next */
  if (!schema) {
    app.log.warn('No graphql schema found, skipping telemetry setup')
    return
  }
  const schemaTypeMap = schema.getTypeMap()
  for (const schemaType of Object.values(schemaTypeMap)) {
    const schemaTypeName = schemaType.name.toLowerCase() // query, mutation, subscription
    if (typeof schemaType.getFields === 'function') {
      for (const [fieldName, field] of Object.entries(schemaType.getFields())) {
        if (typeof field.resolve === 'function' && !schemaTypeName.startsWith('__')) {
          field.resolve = telemetryWrapper(app, field.resolve, schemaTypeName, fieldName)
        }
      }
    }
  }
}

module.exports = setupTelemetry
