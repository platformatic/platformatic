'use strict'

const Ajv = require('ajv')
const camelCase = require('camelcase')
const sjson = require('secure-json-parse')
const { UnableToParseCursorStrError, CursorValidationError, PrimaryKeyNotIncludedInOrderByInCursorPaginationError } = require('./errors')

const ajv = new Ajv({
  coerceTypes: 'array',
  useDefaults: true,
  removeAdditional: true,
  uriResolver: require('fast-uri'),
  addUsedSchema: false,
  allErrors: false
})

function buildCursorUtils (app, entity) {
  const entitySchema = app.getSchema(entity.name)
  const cursorSchema = {
    $id: entity.name + 'Cursor',
    title: entitySchema.title + ' Cursor',
    description: entitySchema.description + ' cursor',
    type: 'object',
    properties: entitySchema.properties,
    additionalProperties: false,
  }
  const validateCursor = ajv.compile(cursorSchema)

  function encodeCursor (cursor) {
    return Buffer.from(JSON.stringify(cursor)).toString('base64')
  }

  function decodeCursor (cursorBase64) {
    const cursorString = Buffer.from(cursorBase64, 'base64').toString()
    let parsedCursor
    try {
      parsedCursor = sjson.parse(cursorString)
    } catch (error) {
      throw new UnableToParseCursorStrError(error.message)
    }
    if (!validateCursor(parsedCursor)) {
      const error = validateCursor.errors[0]
      throw new CursorValidationError(`${error.instancePath} ${error.message}`)
    }
    return parsedCursor
  }

  function transformQueryToCursor ({ startAfter, endBefore }) {
    const parsedData = {
      nextPage: true,
      cursor: null,
    }
    if (startAfter) {
      parsedData.cursor = decodeCursor(startAfter)
    } else if (endBefore) {
      parsedData.cursor = decodeCursor(endBefore)
      parsedData.nextPage = false
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
      endBefore: encodeCursor(firstItemCursor),
      startAfter: encodeCursor(lastItemCursor),
    }
  }

  return {
    transformQueryToCursor,
    buildCursorHeaders
  }
}

module.exports = {
  buildCursorUtils,
}
