import { UnknownFieldError } from '../errors.js'
import { tableName } from '../utils.js'

/* istanbul ignore file */

export async function insertOne (db, sql, table, schema, input, primaryKeysTypes, fieldsToRetrieve) {
  const inputKeys = Object.keys(input)
  if (inputKeys.length === 0) {
    const insert = sql`
      INSERT INTO ${tableName(sql, table, schema)}
      ()
      VALUES ()
      RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
    `
    const res = await db.query(insert)
    return res[0]
  }

  const keys = sql.join(
    inputKeys.map(key => sql.ident(key)),
    sql`, `
  )
  const values = sql.join(
    Object.keys(input).map(key => {
      const val = input[key]
      return sql.value(val)
    }),
    sql`, `
  )

  const insert = sql`
    INSERT INTO ${tableName(sql, table, schema)} (${keys})
    VALUES (${values})
    RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
  `
  const res = await db.query(insert)
  return res[0]
}

export async function deleteAll (db, sql, table, schema, criteria, fieldsToRetrieve) {
  let query = sql`
      DELETE FROM ${tableName(sql, table, schema)}
    `

  if (criteria.length > 0) {
    query = sql`${query} WHERE ${sql.join(criteria, sql` AND `)}`
  }

  query = sql`${query} RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}`
  const res = await db.query(query)
  return res
}

export async function insertMany (
  db,
  sql,
  table,
  schema,
  inputs,
  inputToFieldMap,
  primaryKey,
  fieldsToRetrieve,
  fields
) {
  const { keys, values } = insertPrep(inputs, inputToFieldMap, fields, sql)
  const insert = sql`
    insert into ${tableName(sql, table, schema)} (${keys})
    values ${sql.join(values, sql`, `)}
    returning ${sql.join(fieldsToRetrieve, sql`, `)}
  `

  const res = await db.query(insert)
  return res
}

export function insertPrep (inputs, inputToFieldMap, fields, sql) {
  const tableFields = Object.keys(fields)
  const inputRaws = []

  for (const input of inputs) {
    for (const entityKey of Object.keys(input)) {
      const field = inputToFieldMap[entityKey]

      if (field === undefined && fields[entityKey] === undefined) {
        throw new UnknownFieldError(entityKey)
      }
    }

    const inputValues = []
    for (const field of tableFields) {
      const fieldMetadata = fields[field]
      const inputKey = fieldMetadata.camelcase

      let inputValue = input[inputKey] ?? input[field]
      if (inputValue && typeof inputValue === 'object' && !fieldMetadata.isArray && !(inputValue instanceof Date)) {
        // This is a JSON field
        inputValue = JSON.stringify(inputValue)
      }

      if (inputValue !== undefined) {
        inputValues.push(sql.value(inputValue))
      } else {
        inputValues.push(sql`DEFAULT`)
      }
    }
    inputRaws.push(sql` (${sql.join(inputValues, sql`, `)})`)
  }
  const keys = sql.join(
    tableFields.map(key => sql.ident(key)),
    sql`, `
  )

  return { keys, values: inputRaws }
}

export async function updateMany (db, sql, table, schema, criteria, input, fieldsToRetrieve) {
  const pairs = Object.keys(input).map(key => {
    const value = input[key]
    return sql`${sql.ident(key)} = ${value}`
  })
  const update = sql`
    UPDATE ${sql.ident(table)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.join(criteria, sql` AND `)}
    RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
    `
  const res = await db.query(update)
  return res
}
