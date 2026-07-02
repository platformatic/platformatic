import { tableName } from '../utils.js'

export async function listTables (db, sql, schemas) {
  if (schemas) {
    const schemaList = sql.__dangerous__rawValue(schemas.map(s => `'${s}'`))
    const res = await db.query(sql`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM information_schema.tables
      WHERE table_schema in (${schemaList})
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    return res.map(r => ({ schema: r.TABLE_SCHEMA, table: r.TABLE_NAME }))
  } else {
    const res = await db.query(sql`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM information_schema.tables
      WHERE table_schema = (SELECT DATABASE())
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    return res.map(r => ({ schema: r.TABLE_SCHEMA, table: r.TABLE_NAME }))
  }
}

export async function listColumns (db, sql, table, schema) {
  const query = sql`
    SELECT column_name as column_name, data_type as udt_name, is_nullable as is_nullable, column_type as column_type, extra as is_generated
    FROM information_schema.columns
    WHERE table_name = ${table}
    AND table_schema = ${schema}
    ORDER BY ordinal_position
  `
  return db.query(query)
}

export async function listConstraints (db, sql, table, schema) {
  const query = sql`
    SELECT k.TABLE_NAME as table_name, k.TABLE_SCHEMA as table_schema, k.COLUMN_NAME as column_name, t.CONSTRAINT_TYPE as constraint_type, k.referenced_table_name AS foreign_table_name, k.referenced_table_schema AS foreign_table_schema, k.referenced_column_name AS foreign_column_name
    FROM information_schema.table_constraints t
    JOIN information_schema.key_column_usage k
    USING (constraint_name, table_schema, table_name)
    JOIN information_schema.columns c
    ON c.table_schema = k.table_schema
    AND c.table_name = k.table_name
    AND c.column_name = k.column_name
    WHERE t.table_name = ${table}
    AND t.table_schema = ${schema}
    ORDER BY c.ordinal_position, CASE t.constraint_type WHEN 'PRIMARY KEY' THEN 0 WHEN 'UNIQUE' THEN 1 WHEN 'FOREIGN KEY' THEN 2 ELSE 3 END, t.constraint_name, k.ordinal_position
    `
  return db.query(query)
}

export async function updateOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
  const pairs = Object.keys(input).map(key => {
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

export async function updateMany (db, sql, table, schema, criteria, input, fieldsToRetrieve) {
  const pairs = Object.keys(input).map(key => {
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

export async function listViews (db, sql, schemas) {
  if (schemas) {
    const schemaList = sql.__dangerous__rawValue(schemas.map(s => `'${s}'`))
    const res = await db.query(sql`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM information_schema.views
      WHERE table_schema in (${schemaList})
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    return res.map(r => ({ schema: r.TABLE_SCHEMA, table: r.TABLE_NAME, isView: true }))
  } else {
    const res = await db.query(sql`
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM information_schema.views
      WHERE table_schema = (SELECT DATABASE())
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    return res.map(r => ({ schema: r.TABLE_SCHEMA, table: r.TABLE_NAME, isView: true }))
  }
}

export const hasILIKE = false
