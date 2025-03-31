'use strict'

const errors = require('./errors')

function encodeCursor () {} // todo(shcube): api
function decodeCursor () {} // todo(shcube): api

function getCursorFields (cursor, orderBy, inputToFieldMap, fields, primaryKeys) {
  if (!orderBy || orderBy.length === 0) throw new errors.MissingOrderByClauseError()
  let hasUniqueField = false
  const validCursorFields = new Map()

  for (const [key, value] of Object.entries(cursor)) {
    const dbField = inputToFieldMap[key]
    if (!dbField) throw new errors.UnknownFieldError(key)
    const order = orderBy.find((order) => order.field === key)
    if (!order) throw new errors.MissingOrderByFieldForCursorError(key)
    if (primaryKeys.has(dbField)) hasUniqueField = true
    validCursorFields.set(key, {
      dbField,
      value,
      direction: order.direction,
      fieldWrap: fields[dbField]
    })
  }
  if (!hasUniqueField) throw new errors.MissingUniqueFieldInCursorError()

  // Process fields in orderBy order
  const cursorFields = []
  for (const order of orderBy) {
    if (validCursorFields.has(order.field)) {
      cursorFields.push(validCursorFields.get(order.field))
    }
  }
  return cursorFields
}

// todo(shcube): remove db prop after test
function buildCursorCondition (sql, cursor, orderBy, inputToFieldMap, fields, computeCriteriaValue, db, primaryKeys, reverse) {
  if (!cursor || Object.keys(cursor).length === 0) return null

  const cursorFields = getCursorFields(cursor, orderBy, inputToFieldMap, fields, primaryKeys)
  const conditions = []
  const equalityParts = []

  for (const { dbField, fieldWrap, value, direction } of cursorFields) {
    let operator
    if (reverse) {
      operator = direction.toLowerCase() === 'desc' ? '>' : '<'
    } else {
      operator = direction.toLowerCase() === 'desc' ? '<' : '>'
    }
    const inequalityPart = sql`${sql.ident(dbField)} ${sql.__dangerous__rawValue(operator)} ${computeCriteriaValue(fieldWrap, value)}`
    if (equalityParts.length === 0) {
      conditions.push(inequalityPart)
    } else {
      conditions.push(sql`${sql.join(equalityParts, sql` AND `)} AND ${inequalityPart}`)
    }
    equalityParts.push(sql`${sql.ident(dbField)} = ${computeCriteriaValue(fieldWrap, value)}`)
  }

  return sql`(${sql.join(conditions, sql` OR `)})`
}

module.exports = {
  buildCursorCondition,
  encodeCursor,
  decodeCursor
}
