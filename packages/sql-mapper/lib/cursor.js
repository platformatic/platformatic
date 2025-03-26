'use strict'

const errors = require('./errors')

function encodeCursor () {} // todo(shcube): api
function decodeCursor () {} // todo(shcube): api
// todo(shcube): verify That unique field present

function getCursorFields (cursor, orderBy, inputToFieldMap, fields) {
  if (!orderBy || orderBy.length === 0) throw new errors.MissingOrderByClauseError()
  const cursorFields = []
  for (const [key, value] of Object.entries(cursor)) {
    const dbField = inputToFieldMap[key]
    if (!dbField) throw new errors.UnknownFieldError(key)
    const order = orderBy.find((order) => order.field === key)
    if (!order) throw new errors.MissingOrderByFieldForCursorError(key)
    cursorFields.push({
      dbField,
      fieldWrap: fields[dbField],
      value,
      direction: order.direction,
    })
  }
  return cursorFields
}

// todo(shcube): remove db prop after test
function buildCursorCondition (sql, cursor, orderBy, inputToFieldMap, fields, computeCriteriaValue, db) {
  if (!cursor || Object.keys(cursor).length === 0) return null

  const cursorFields = getCursorFields(cursor, orderBy, inputToFieldMap, fields)
  const conditions = []
  const equalityParts = []

  for (const { dbField, fieldWrap, value, direction } of cursorFields) {
    const operator = direction.toLowerCase() === 'desc' ? '<' : '>'
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
