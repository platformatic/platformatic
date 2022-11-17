'use strict'

/* istanbul ignore file */

async function insertOne (db, sql, table, input, primaryKey, isUuid, fieldsToRetrieve) {
  const inputKeys = Object.keys(input)
  if (inputKeys.length === 0) {
    const insert = sql`
      INSERT INTO ${sql.ident(table)}
      ()
      VALUES ()
      RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
    `
    const res = await db.query(insert)
    return res[0]
  }

  const keys = sql.join(
    inputKeys.map((key) => sql.ident(key)),
    sql`, `
  )
  const values = sql.join(
    Object.keys(input).map((key) => sql.value(input[key])),
    sql`, `
  )
  const insert = sql`
    INSERT INTO ${sql.ident(table)} (${keys})
    VALUES (${values})
    RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
  `
  const res = await db.query(insert)
  return res[0]
}

async function deleteAll (db, sql, table, criteria, fieldsToRetrieve) {
  let query = sql`
      DELETE FROM ${sql.ident(table)}
    `

  if (criteria.length > 0) {
    query = sql`${query} WHERE ${sql.join(criteria, sql` AND `)}`
  }

  query = sql`${query} RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}`
  const res = await db.query(query)
  return res
}

async function insertMany (db, sql, table, inputs, inputToFieldMap, primaryKey, fieldsToRetrieve, fields) {
  const { keys, values } = insertPrep(inputs, inputToFieldMap, fields, sql)
  const insert = sql`
    insert into ${sql.ident(table)} (${keys})
    values ${sql.join(values, sql`, `)}
    returning ${sql.join(fieldsToRetrieve, sql`, `)}
  `

  const res = await db.query(insert)
  return res
}

function insertPrep (inputs, inputToFieldMap, fields, sql) {
  const inputSet = new Set()
  const values = []
  for (const input of inputs) {
    const inputValues = []
    for (const key of Object.keys(input)) {
      let newKey = key
      if (inputToFieldMap[key] === undefined) {
        if (fields[key] === undefined) {
          throw new Error('Unknown field ' + key)
        }
      } else {
        newKey = inputToFieldMap[key]
      }

      inputSet.add(newKey)

      let value = input[key] || input[newKey]

      if (value && typeof value === 'object' && !(value instanceof Date)) {
        // This is a JSON field
        value = JSON.stringify(value)
      }

      inputValues.push(sql.value(value))
    }

    values.push(sql` (${sql.join(
      inputValues,
      sql`, `
    )})`)
  }
  const inputKeys = Array.from(inputSet)
  const keys = sql.join(
    inputKeys.map((key) => sql.ident(key)),
    sql`, `
  )
  return { keys, values }
}

async function updateMany (db, sql, table, criteria, input, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
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

module.exports = {
  insertOne,
  insertPrep,
  deleteAll,
  insertMany,
  updateMany
}
