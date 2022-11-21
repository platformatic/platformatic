'use strict'

const { randomUUID } = require('crypto')
const shared = require('./shared')

async function listTables (db, sql) {
  const res = await db.query(sql`
    SELECT name FROM sqlite_master
    WHERE type='table'
  `)
  // sqlite has no schemas
  return res.map(r => ({ schema: null, table: r.name }))
}

module.exports.listTables = listTables

async function listColumns (db, sql, table) {
  const columns = await db.query(sql`
    SELECT * FROM pragma_table_info(${table})
  `)
  for (const column of columns) {
    column.column_name = column.name
    // convert varchar(42) in varchar
    column.udt_name = column.type.replace(/^([^(]+).*/, '$1').toLowerCase()
    // convert is_nullable
    column.is_nullable = column.notnull === 0 && column.pk === 0 ? 'YES' : 'NO'
  }
  return columns
}

module.exports.listColumns = listColumns

async function listConstraints (db, sql, table) {
  const constraints = []
  const pks = await db.query(sql`
    SELECT *
    FROM pragma_table_info(${table})
    WHERE pk > 0
  `)

  if (pks.length > 1) {
    throw new Error(`Table ${table} has ${pks.length} primary keys`)
  }

  if (pks.length === 1) {
    constraints.push({
      column_name: pks[0].name,
      constraint_type: 'PRIMARY KEY'
    })
  }

  const foreignKeys = await db.query(sql`
    SELECT *
    FROM pragma_foreign_key_list(${table})
  `)

  for (const foreignKey of foreignKeys) {
    constraints.push({
      table_name: table,
      column_name: foreignKey.from,
      constraint_type: 'FOREIGN KEY',
      foreign_table_name: foreignKey.table,
      foreign_column_name: foreignKey.to
    })
  }
  return constraints
}

module.exports.listConstraints = listConstraints

async function insertOne (db, sql, table, schema, input, primaryKey, useUUID, fieldsToRetrieve) {
  const fieldNames = Object.keys(input)
  const keysToSql = fieldNames.map((key) => sql.ident(key))
  const valuesToSql = fieldNames.map((key) => sql.value(input[key]))

  let primaryKeyValue
  if (fieldNames.indexOf(primaryKey) === -1) {
    keysToSql.push(sql.ident(primaryKey))
    if (useUUID) {
      primaryKeyValue = randomUUID()
    } else {
      primaryKeyValue = null
    }
    valuesToSql.push(sql.value(primaryKeyValue))
  }

  const keys = sql.join(
    keysToSql,
    sql`, `
  )

  const values = sql.join(
    valuesToSql,
    sql`, `
  )

  const insert = sql`
    INSERT INTO ${sql.ident(table)} (${keys})
    VALUES(${values})
  `
  await db.query(insert)

  if (!useUUID) {
    const res2 = await db.query(sql`
      SELECT last_insert_rowid()
    `)

    primaryKeyValue = res2[0]['last_insert_rowid()']
  }

  const res = await db.query(sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${sql.ident(table)}
    WHERE ${sql.ident(primaryKey)} = ${sql.value(primaryKeyValue)}
  `)

  return res[0]
}

module.exports.insertOne = insertOne

async function updateOne (db, sql, table, schema, input, primaryKey, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
    const value = input[key]
    return sql`${sql.ident(key)} = ${value}`
  })

  const update = sql`
    UPDATE ${sql.ident(table)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.ident(primaryKey)} = ${sql.value(input[primaryKey])}
  `
  await db.query(update)

  const select = sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${sql.ident(table)}
    WHERE ${sql.ident(primaryKey)} = ${sql.value(input[primaryKey])}
  `
  const res = await db.query(select)
  return res[0]
}

module.exports.updateOne = updateOne

async function deleteAll (db, sql, table, schema, criteria, fieldsToRetrieve) {
  let query = sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${sql.ident(table)}
  `

  /* istanbul ignore else */
  if (criteria.length > 0) {
    query = sql`${query} WHERE ${sql.join(criteria, sql` AND `)}`
  }

  const data = await db.query(query)

  query = sql`
    DELETE FROM ${sql.ident(table)}
  `

  /* istanbul ignore else */
  if (criteria.length > 0) {
    query = sql`${query} WHERE ${sql.join(criteria, sql` AND `)}`
  }

  await db.query(query)

  return data
}

module.exports.deleteAll = deleteAll

module.exports.updateMany = shared.updateMany
