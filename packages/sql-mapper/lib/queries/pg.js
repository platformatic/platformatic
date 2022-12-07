'use strict'

const shared = require('./shared')
const { tableName } = require('../utils')

async function insertOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
  const inputKeys = Object.keys(input)
  if (inputKeys.length === 0) {
    const insert = sql`
      INSERT INTO ${tableName(sql, table, schema)}
      DEFAULT VALUES
      RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
    `
    const res = await db.query(insert)
    return res[0]
  }
  return shared.insertOne(db, sql, table, schema, input, primaryKeys, fieldsToRetrieve)
}

module.exports.insertOne = insertOne
module.exports.deleteAll = shared.deleteAll
module.exports.insertMany = shared.insertMany

async function listTables (db, sql, schemas) {
  if (schemas) {
    const schemaList = sql.__dangerous__rawValue(schemas.map(s => `'${s}'`))
    const res = await db.query(sql`
    SELECT tablename, schemaname
    FROM pg_catalog.pg_tables
    WHERE
      schemaname in (${schemaList})`)
    return res.map(r => ({ schema: r.schemaname, table: r.tablename }))
  }
  const res = await db.query(sql`
    SELECT tablename, schemaname
    FROM pg_catalog.pg_tables
    WHERE
      schemaname = current_schema()
  `)
  return res.map(r => ({ schema: r.schemaname, table: r.tablename }))
}

module.exports.listTables = listTables

async function listColumns (db, sql, table, schema) {
  return db.query(sql`
    SELECT column_name, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = ${table}
    AND table_schema = ${schema}
  `)
}

module.exports.listColumns = listColumns

async function listConstraints (db, sql, table, schema) {
  const query = sql`
    SELECT constraints.*, usage.*, usage2.table_name AS foreign_table_name, usage2.column_name AS foreign_column_name
    FROM information_schema.table_constraints constraints
      JOIN information_schema.key_column_usage usage
        ON constraints.constraint_name = usage.constraint_name
        AND constraints.table_name = ${table}
      JOIN information_schema.constraint_column_usage usage2
        ON usage.constraint_name = usage2.constraint_name
        AND ( usage.table_name = ${table}
        AND usage.table_schema = ${schema} )
  `
  const constraintsList = await db.query(query)
  return constraintsList
}

module.exports.listConstraints = listConstraints

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
    UPDATE ${tableName(sql, table, schema)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.join(where, sql` AND `)}
    RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
  `
  const res = await db.query(update)
  return res[0]
}

module.exports.updateOne = updateOne

module.exports.updateMany = shared.updateMany

async function listEnumValues (db, sql, table, schema) {
  const query = sql`
    SELECT udt_name, enumlabel, column_name
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    JOIN information_schema.columns c on c.udt_name = t.typname
    WHERE table_name = ${table}
    AND table_schema = ${schema};
    `
  return db.query(query)
}

module.exports.listEnumValues = listEnumValues
