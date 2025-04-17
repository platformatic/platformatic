'use strict'

const { UnableToDecodeCursor, PrimaryKeyNotIncludedInOrderByInCursorPaginationError } = require('./errors')
const camelCase = require('camelcase')

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

// todo(shcube): can be bigint in cursor?
function encodeCursor (cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor (cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString())
}

function transformQueryToCursor ({ startAfter, endBefore }) {
  const parsedData = {
    nextPage: true,
    cursor: null,
  }
  if (!startAfter && !endBefore) return parsedData
  try {
    if (startAfter) {
      parsedData.cursor = decodeCursor(startAfter)
    }
    if (endBefore) {
      parsedData.cursor = decodeCursor(endBefore)
      parsedData.nextPage = false
    }
  } catch {
    throw new UnableToDecodeCursor()
  }
  return parsedData
};

function buildCursorHeaders ({ findResult, orderBy, primaryKeys }) {
  const firstItem = findResult.at(0)
  const lastItem = findResult.at(-1)
  const firstItemCursor = {}
  const lastItemCursor = {}
  const camelCasedPrimaryKeys = Array.from(primaryKeys).map((key) => camelCase(key))
  let hasPrimaryKey = false
  for (const { field } of orderBy) {
    if (firstItem[field] === undefined) continue
    firstItemCursor[field] = firstItem[field]
    lastItemCursor[field] = lastItem[field]
    if (camelCasedPrimaryKeys.includes(field)) hasPrimaryKey = true
  }
  if (!hasPrimaryKey) throw new PrimaryKeyNotIncludedInOrderByInCursorPaginationError()
  return {
    startAfter: encodeCursor(firstItemCursor),
    endBefore: encodeCursor(lastItemCursor),
  }
}

module.exports = {
  getSchemaOverrideFromOpenApiPathItem,
  decodeCursor,
  encodeCursor,
  transformQueryToCursor,
  buildCursorHeaders,
}
