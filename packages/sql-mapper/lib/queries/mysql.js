'use strict'

const { insertPrep } = require('./shared')
const shared = require('./mysql-shared')
const { tableName } = require('../utils')

function insertOne (db, sql, table, schema, input, primaryKey, useUUID, fieldsToRetrieve) {
  const keysToSql = Object.keys(input).map((key) => sql.ident(key))
  const keys = sql.join(
    keysToSql,
    sql`, `
  )

  const valuesToSql = Object.keys(input).map((key) => {
    /* istanbul ignore next */
    if (input[key] && typeof input[key] === 'object' && !(input[key] instanceof Date)) {
      // This is a JSON field
      return sql.value(JSON.stringify(input[key]))
    }
    return sql.value(input[key])
  })
  const values = sql.join(
    valuesToSql,
    sql`, `
  )

  return db.tx(async function (db) {
    const insert = sql`
      INSERT INTO ${tableName(sql, table, schema)} (${keys})
      VALUES(${values})
    `
    await db.query(insert)

    const res2 = await db.query(sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${tableName(sql, table, schema)}
      WHERE ${sql.ident(primaryKey)} = (
        SELECT last_insert_id()
      )
    `)

    return res2[0]
  })
}

function insertMany (db, sql, table, schema, inputs, inputToFieldMap, primaryKey, fieldsToRetrieve, fields) {
  return db.tx(async function (db) {
    const { keys, values } = insertPrep(inputs, inputToFieldMap, fields, sql)
    const insert = sql`
      insert into ${tableName(sql, table, schema)} (${keys})
      values ${sql.join(values, sql`, `)}
    `

    await db.query(insert)

    const res = await db.query(sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${tableName(sql, table, schema)}
      ORDER BY ${sql.ident(primaryKey)} DESC
      LIMIT ${inputs.length}
    `)

    // To make consistent with shared.insertMany
    res.sort(function (a, b) {
      return a.id - b.id
    })
    return res
  })
}

function deleteAll (db, sql, table, schema, criteria, fieldsToRetrieve) {
  return db.tx(async function (db) {
    let selectQuery = sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${tableName(sql, table, schema)}
    `
    /* istanbul ignore else */
    if (criteria.length > 0) {
      selectQuery = sql`
        ${selectQuery}
        WHERE ${sql.join(criteria, sql` AND `)}
      `
    }

    const res = await db.query(selectQuery)

    let deleteQuery = sql`
      DELETE FROM ${tableName(sql, table, schema)}
    `

    /* istanbul ignore else */
    if (criteria.length > 0) {
      deleteQuery = sql`
        ${deleteQuery}
        WHERE ${sql.join(criteria, sql` AND `)}
      `
    }

    await db.query(deleteQuery)

    return res
  })
}

module.exports = {
  ...shared,
  insertOne,
  insertMany,
  deleteAll
}
