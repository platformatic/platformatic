import {
  MissingOrderByClauseError,
  MissingOrderByFieldForCursorError,
  MissingUniqueFieldInCursorError,
  UnknownFieldError
} from './errors.js'

function sanitizeCursor (cursor, orderBy, inputToFieldMap, fields, primaryKeys) {
  if (!orderBy || orderBy.length === 0) throw new MissingOrderByClauseError()
  let hasUniqueField = false
  const validCursorFields = new Map()

  for (const [key, value] of Object.entries(cursor)) {
    const dbField = inputToFieldMap[key]
    if (!dbField) throw new UnknownFieldError(key)
    const order = orderBy.find(order => order.field === key)
    if (!order) throw new MissingOrderByFieldForCursorError(key)
    if (primaryKeys.has(dbField)) hasUniqueField = true
    validCursorFields.set(key, {
      dbField,
      value,
      direction: order.direction.toLowerCase(),
      fieldWrap: fields[dbField]
    })
  }
  if (!hasUniqueField) throw new MissingUniqueFieldInCursorError()

  // Process fields in orderBy order
  const cursorFields = []
  for (const order of orderBy) {
    if (validCursorFields.has(order.field)) {
      cursorFields.push(validCursorFields.get(order.field))
    }
  }
  return cursorFields
}

function buildTupleQuery (cursorFields, sql, computeCriteriaValue, isBackwardPagination) {
  const direction = cursorFields[0].direction
  let operator
  if (isBackwardPagination) {
    operator = direction === 'desc' ? '>' : '<'
  } else {
    operator = direction === 'desc' ? '<' : '>'
  }
  const fields = sql.join(
    cursorFields.map(({ dbField }) => sql.ident(dbField)),
    sql`, `
  )
  const values = sql.join(
    cursorFields.map(({ fieldWrap, value }) => computeCriteriaValue(fieldWrap, value)),
    sql`, `
  )
  return sql`(${fields}) ${sql.__dangerous__rawValue(operator)} (${values})`
}

function buildQuery (cursorFields, sql, computeCriteriaValue, isBackwardPagination) {
  const conditions = []
  const equalityParts = []
  for (const { dbField, fieldWrap, value, direction } of cursorFields) {
    let operator
    if (isBackwardPagination) {
      operator = direction === 'desc' ? '>' : '<'
    } else {
      operator = direction === 'desc' ? '<' : '>'
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

export function buildCursorCondition (
  sql,
  cursor,
  orderBy,
  inputToFieldMap,
  fields,
  computeCriteriaValue,
  primaryKeys,
  isBackwardPagination
) {
  if (!cursor || Object.keys(cursor).length === 0) return null
  const cursorFields = sanitizeCursor(cursor, orderBy, inputToFieldMap, fields, primaryKeys)
  const sameSortDirection = cursorFields.every(({ direction }) => direction === cursorFields[0].direction)
  return sameSortDirection
    ? buildTupleQuery(cursorFields, sql, computeCriteriaValue, isBackwardPagination)
    : buildQuery(cursorFields, sql, computeCriteriaValue, isBackwardPagination)
}
