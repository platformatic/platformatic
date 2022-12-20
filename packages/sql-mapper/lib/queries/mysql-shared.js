'use strict'

const { tableName } = require('../utils')

async function listTables (db, sql, schemas) {
  if (schemas) {
    const schemaList = sql.__dangerous__rawValue(schemas.map(s => `'${s}'`))
    const res = await db.query(sql`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM information_schema.tables
      WHERE table_schema in (${schemaList})
    `)
    return res.map(r => ({ schema: r.TABLE_SCHEMA, table: r.TABLE_NAME }))
  } else {
    const res = await db.query(sql`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM information_schema.tables
      WHERE table_schema = (SELECT DATABASE())
    `)
    return res.map(r => ({ schema: r.TABLE_SCHEMA, table: r.TABLE_NAME }))
  }
}

async function listColumns (db, sql, table, schema) {
  const query = sql`
    SELECT column_name as column_name, data_type as udt_name, is_nullable as is_nullable, column_type as column_type, extra as is_generated
    FROM information_schema.columns
    WHERE table_name = ${table}
    AND table_schema = ${schema}
  `
  return db.query(query)
}

async function listConstraints (db, sql, table, schema) {
  const query = sql`
    SELECT TABLE_NAME as table_name, TABLE_SCHEMA as table_schema, COLUMN_NAME as column_name, CONSTRAINT_TYPE as constraint_type, referenced_table_name AS foreign_table_name, referenced_table_schema AS foreign_table_schema, referenced_column_name AS foreign_column_name
    FROM information_schema.table_constraints t
    JOIN information_schema.key_column_usage k
    USING (constraint_name, table_schema, table_name)
    WHERE t.table_name = ${table}
    AND t.table_schema = ${schema}
    `
  return db.query(query)
}

async function updateOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
    let value = input[key]
    /* istanbul ignore next */
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      value = JSON.stringify(value)
    }
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
  `
  await db.query(update)

  const select = sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${tableName(sql, table, schema)}
    WHERE ${sql.join(where, sql` AND `)}
  `

  const res = await db.query(select)
  return res[0]
}

async function updateMany (db, sql, table, schema, criteria, input, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
    let value = input[key]
    /* istanbul ignore next */
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      value = JSON.stringify(value)
    }
    return sql`${sql.ident(key)} = ${value}`
  })

  const selectIds = sql`
    SELECT id
    FROM ${tableName(sql, table, schema)}
    WHERE ${sql.join(criteria, sql` AND `)}
  `
  const resp = await db.query(selectIds)
  const ids = resp.map(({ id }) => id)

  const update = sql`
    UPDATE ${tableName(sql, table, schema)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.join(criteria, sql` AND `)}
  `

  await db.query(update)

  const select = sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${tableName(sql, table, schema)}
    WHERE id IN (${ids});
  `
  const res = await db.query(select)
  return res
}

module.exports = {
  listTables,
  listColumns,
  listConstraints,
  updateOne,
  updateMany
}
