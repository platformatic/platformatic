'use strict'

async function listTables (db, sql) {
  const res = await db.query(sql`
    SELECT TABLE_NAME
    FROM information_schema.tables
    WHERE table_schema = (SELECT DATABASE())
  `)
  return res.map(r => r.TABLE_NAME)
}

async function listColumns (db, sql, table) {
  const res = await db.query(sql`
    SELECT column_name as column_name, data_type as udt_name, is_nullable as is_nullable, column_type as column_type
    FROM information_schema.columns
    WHERE table_name = ${table}
    AND table_schema = (SELECT DATABASE())
  `)
  return res
}

async function listConstraints (db, sql, table) {
  const res = await db.query(sql`
    SELECT TABLE_NAME as table_name, COLUMN_NAME as column_name, CONSTRAINT_TYPE as constraint_type, referenced_table_name AS foreign_table_name, referenced_column_name AS foreign_column_name
    FROM information_schema.table_constraints t
    JOIN information_schema.key_column_usage k
    USING (constraint_name, table_schema, table_name)
    WHERE t.table_name = ${table}
    AND t.table_schema = (SELECT DATABASE())
  `)

  return res
}

async function updateOne (db, sql, table, input, primaryKey, fieldsToRetrieve) {
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

async function updateMany (db, sql, table, criteria, input, fieldsToRetrieve) {
  const pairs = Object.keys(input).map((key) => {
    const value = input[key]
    return sql`${sql.ident(key)} = ${value}`
  })

  const selectIds = sql`
    SELECT id
    FROM ${sql.ident(table)}
    WHERE ${sql.join(criteria, sql` AND `)}
  `
  const resp = await db.query(selectIds)
  const ids = resp.map(({ id }) => id)

  const update = sql`
    UPDATE ${sql.ident(table)}
    SET ${sql.join(pairs, sql`, `)}
    WHERE ${sql.join(criteria, sql` AND `)}
  `

  await db.query(update)

  const select = sql`
    SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
    FROM ${sql.ident(table)}
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
