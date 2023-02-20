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
  // pragma_table_info is not returning hidden column which tells if the column is generated or not
  // therefore it is changed to pragma_table_xinfo
  const columns = await db.query(sql`
    SELECT * FROM pragma_table_xinfo(${table})
  `)
  for (const column of columns) {
    column.column_name = column.name
    // convert varchar(42) in varchar
    column.udt_name = column.type.replace(/^([^(]+).*/, '$1').toLowerCase()
    // convert is_nullable
    column.is_nullable = column.notnull === 0 && column.pk === 0 ? 'YES' : 'NO'
    // convert hidden to is_generated
    column.is_generated = (column.hidden === 2 || column.hidden === 3) ? 'YES' : 'NO'
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
  const primaryKeyValues = {}

  let hasAutoIncrementPK = false

  for (const { key, sqlType } of primaryKeys) {
    let primaryKeyValue = input[key]

    /* istanbul ignore next */
    if (primaryKeyValue === undefined) {
      if (sqlType === 'uuid') {
        primaryKeyValue = randomUUID()
      } else if (!hasAutoIncrementPK) {
        primaryKeyValue = null
        hasAutoIncrementPK = true
      } else {
        throw new Error('SQLite only supports autoIncrement on one column')
      }
      input[key] = primaryKeyValue
    }

    primaryKeyValues[key] = primaryKeyValue
  }

  const insertedKeys = []
  const insertedValues = []

  for (const [key, value] of Object.entries(input)) {
    insertedKeys.push(sql.ident(key))
    insertedValues.push(sql.value(value))
  }

  const insertRawQuery = sql`
    INSERT INTO ${sql.ident(table)} (${sql.join(insertedKeys, sql`, `)})
    VALUES(${sql.join(insertedValues, sql`, `)})
  `

  if (fieldsToRetrieve.length === 0) {
    await db.query(insertRawQuery)
    return {}
  } else if (typeof db.tx === 'function') {
    return db.tx(handleAutoIncrement)
  } else {
    // TODO add a log at trace level if we do this
    // There are not nested transactions in SQLite, so we can just run the query
    // because we are already in a transaction.
    return handleAutoIncrement(db)
  }

  async function handleAutoIncrement (transaction) {
    await transaction.query(insertRawQuery)

    let selectInsertedRawQuery = null
    if (hasAutoIncrementPK) {
      selectInsertedRawQuery = sql`
          SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
          FROM ${sql.ident(table)}
          WHERE _rowid_ = last_insert_rowid()
        `
    } else {
      const where = []
      for (const [key, value] of Object.entries(primaryKeyValues)) {
        where.push(sql`${sql.ident(key)} = ${sql.value(value)}`)
      }

      selectInsertedRawQuery = sql`
          SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
          FROM ${sql.ident(table)}
          WHERE ${sql.join(where, sql` AND `)}
        `
    }

    const [insertedRaw] = await transaction.query(selectInsertedRawQuery)
    return insertedRaw
  }
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
