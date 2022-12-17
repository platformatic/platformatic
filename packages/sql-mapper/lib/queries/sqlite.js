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

  for (const pk of pks) {
    constraints.push({
      column_name: pk.name,
      constraint_type: 'PRIMARY KEY'
    })
  }

  const indexes = await db.query(sql`
    SELECT  *
    FROM    pragma_index_list(${table}) as il
    JOIN    pragma_index_info(il.name) as ii
  `)

  for (const index of indexes) {
    /* istanbul ignore else */
    if (index.unique === 1) {
      constraints.push({
        column_name: index.name,
        constraint_type: 'UNIQUE'
      })
    }
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

async function insertOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
  const fieldNames = Object.keys(input)
  const keysToSql = fieldNames.map((key) => sql.ident(key))
  const valuesToSql = fieldNames.map((key) => sql.value(input[key]))

  const primaryKeyValues = {}
  let useUUID = false
  const where = []
  let autoIncrement = 0
  for (const { key, sqlType } of primaryKeys) {
    keysToSql.push(sql.ident(key))
    // TODO figure out while this is not covered by tests
    /* istanbul ignore next */
    if (sqlType === 'uuid') {
      useUUID = true
      primaryKeyValues[key] = randomUUID()
    } else if (autoIncrement > 1) {
      throw new Error('SQLite only supports autoIncrement on one column')
    } else if (input[key]) {
      primaryKeyValues[key] = input[key]
    } else {
      autoIncrement++
      primaryKeyValues[key] = null
    }
    valuesToSql.push(sql.value(primaryKeyValues[key]))
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

  if (!useUUID && primaryKeys.length === 1) {
    const res2 = await db.query(sql`
      SELECT last_insert_rowid()
    `)

    primaryKeyValues[primaryKeys[0].key] = res2[0]['last_insert_rowid()']
  }

  for (const { key } of primaryKeys) {
    where.push(sql`${sql.ident(key)} = ${sql.value(primaryKeyValues[key])}`)
  }

  const res = await db.query(sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${sql.ident(table)}
    WHERE ${sql.join(where, sql` AND `)}
  `)

  return res[0]
}

module.exports.insertOne = insertOne

async function updateOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
    const value = input[key]
    return sql`${sql.ident(key)} = ${value}`
  })

  const where = []
  for (const key of primaryKeys) {
    where.push(sql`${sql.ident(key)} = ${input[key]}`)
  }

  const update = sql`
    UPDATE ${sql.ident(table)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.join(where, sql` AND `)}
  `
  await db.query(update)

  const select = sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${sql.ident(table)}
    WHERE ${sql.join(where, sql` AND `)}
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
