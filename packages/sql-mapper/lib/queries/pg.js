'use strict'

const shared = require('./shared')

async function insertOne (db, sql, table, input, primaryKey, isUuid, fieldsToRetrieve) {
  const inputKeys = Object.keys(input)
  if (inputKeys.length === 0) {
    const insert = sql`
      INSERT INTO ${sql.ident(table)}
      DEFAULT VALUES
      RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
    `
    const res = await db.query(insert)
    return res[0]
  }

  return shared.insertOne(db, sql, table, input, primaryKey, isUuid, fieldsToRetrieve)
}

module.exports.insertOne = insertOne
module.exports.deleteAll = shared.deleteAll
module.exports.insertMany = shared.insertMany

async function listTables (db, sql) {
  return (await db.query(sql`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE
      schemaname = current_schema()
    `)).map(t => t.tablename)
}

module.exports.listTables = listTables

async function listColumns (db, sql, table) {
  return db.query(sql`
    SELECT column_name, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = ${table}
    AND table_schema = current_schema()
  `)
}

module.exports.listColumns = listColumns

async function listConstraints (db, sql, table) {
  const query = sql`
    SELECT constraints.*, usage.*, usage2.table_name AS foreign_table_name, usage2.column_name AS foreign_column_name
    FROM information_schema.table_constraints constraints
      JOIN information_schema.key_column_usage usage
        ON constraints.constraint_name = usage.constraint_name
        AND constraints.table_name = ${table}
      JOIN information_schema.constraint_column_usage usage2
        ON usage.constraint_name = usage2.constraint_name
        AND usage.table_name = ${table}
  `

  const constraintsList = await db.query(query)
  return constraintsList
}

module.exports.listConstraints = listConstraints

async function updateOne (db, sql, table, input, primaryKey, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
    const value = input[key]
    return sql`${sql.ident(key)} = ${value}`
  })
  const update = sql`
    UPDATE ${sql.ident(table)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.ident(primaryKey)} = ${sql.value(input[primaryKey])}
    RETURNING ${sql.join(fieldsToRetrieve, sql`, `)}
  `
  const res = await db.query(update)
  return res[0]
}

module.exports.updateOne = updateOne

async function listEnumValues (db, sql, table) {
  return (await db.query(sql`
  SELECT udt_name, enumlabel, column_name
  FROM pg_enum e 
  JOIN pg_type t ON e.enumtypid = t.oid 
  JOIN information_schema.columns c on c.udt_name = t.typname
  WHERE table_name = ${table};
  `))
}

module.exports.listEnumValues = listEnumValues
