import Ajv from 'ajv'
import camelCase from 'camelcase'
import fjs from 'fast-json-stringify'
import fastUri from 'fast-uri'
import sjson from 'secure-json-parse'
import {
  CursorValidationError,
  PrimaryKeyNotIncludedInOrderByInCursorPaginationError,
  UnableToParseCursorStrError
} from './errors.js'

const ajvOptions = {
  coerceTypes: 'array',
  useDefaults: true,
  removeAdditional: true,
  uriResolver: fastUri,
  addUsedSchema: false,
  allErrors: false
}
const ajv = new Ajv(ajvOptions)

export function buildCursorUtils (app, entity) {
  const entitySchema = app.getSchema(entity.name)
  const cursorSchema = {
    $id: entity.name + 'Cursor',
    title: entitySchema.title + ' Cursor',
    description: entitySchema.description + ' cursor',
    type: 'object',
    properties: entitySchema.properties,
    additionalProperties: false
  }
  const validateCursor = ajv.compile(cursorSchema)
  const stringifyCursor = fjs(cursorSchema, {
    ajv: ajvOptions
  })

  function encodeCursor (cursor) {
    return Buffer.from(stringifyCursor(cursor)).toString('base64')
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
      cursor: null
    }
    if (startAfter) {
      parsedData.cursor = decodeCursor(startAfter)
    } else if (endBefore) {
      parsedData.cursor = decodeCursor(endBefore)
      parsedData.nextPage = false
    }
    return parsedData
  }

  function buildCursorHeaders ({ findResult, orderBy, primaryKeys }) {
    const firstItem = findResult.at(0)
    const lastItem = findResult.at(-1)
    const firstItemCursor = {}
    const lastItemCursor = {}
    const camelCasedPrimaryKeys = Array.from(primaryKeys).map(key => camelCase(key))
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
      startAfter: encodeCursor(lastItemCursor)
    }
  }

  return {
    transformQueryToCursor,
    buildCursorHeaders
  }
}
