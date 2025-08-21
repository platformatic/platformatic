function telemetryWrapper (app, fn, operationType, operationName) {
  return async function (...args) {
    const { startSpan, endSpan } = app.openTelemetry
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

    const span = startSpan(spanName, ctx, telemetryAttributes)
    try {
      const result = await fn(...args)
      endSpan(span)
      return result
      // We ignore this because in sqlite it's HARD to have a resolver exception without a schema validation exception first.
    } catch (err) /* istanbul ignore next */ {
      endSpan(span, err)
      throw err
    }
  }
}

export function setupTelemetry (app) {
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
          field.resolve.__wrapped = true
        }
      }
    }
  }
}
