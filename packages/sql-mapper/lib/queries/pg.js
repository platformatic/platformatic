import { tableName } from '../utils.js'
import { insertOne as sharedInsertOne } from './shared.js'
export { deleteAll, insertMany, updateMany } from './shared.js'

export async function insertOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
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
  return sharedInsertOne(db, sql, table, schema, input, primaryKeys, fieldsToRetrieve)
}

export async function listTables (db, sql, schemas) {
  if (schemas) {
    const schemaList = sql.__dangerous__rawValue(schemas.map(s => `'${s}'`))
    const res = await db.query(sql`
    SELECT tablename, schemaname
    FROM pg_catalog.pg_tables
    WHERE
      schemaname in (${schemaList})
    ORDER BY schemaname, tablename`)
    return res.map(r => ({ schema: r.schemaname, table: r.tablename }))
  }
  const res = await db.query(sql`
    SELECT tablename, schemaname
    FROM pg_catalog.pg_tables
    WHERE
      schemaname = current_schema()
    ORDER BY schemaname, tablename
  `)
  return res.map(r => ({ schema: r.schemaname, table: r.tablename }))
}

export async function listColumns (db, sql, table, schema) {
  /*
  return db.query(sql`
    SELECT column_name, udt_name, is_nullable, is_generated
    FROM information_schema.columns
    WHERE table_name = ${table}
    AND table_schema = ${schema}
  `)
  */

  const res = await db.query(sql`
    SELECT c.column_name, c.udt_name, c.is_nullable, c.is_generated, c.data_type,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS formatted_type
    FROM information_schema.columns c
    JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
    JOIN pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
    JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
    WHERE c.table_name = ${table}
    AND c.table_schema = ${schema}
    AND a.attnum > 0
    AND NOT a.attisdropped
    ORDER BY a.attnum
  `)

  for (const col of res) {
    if (col.data_type === 'ARRAY') {
      col.udt_name = col.udt_name.replace(/^_/, '')
      col.isArray = true
    } else {
      col.isArray = false
    }

    const match = col.formatted_type?.match(/^vector\((\d+)\)$/)
    if (match) {
      col.vectorDimensions = Number(match[1])
    }
  }

  return res
}

export async function listConstraints (db, sql, table, schema) {
  const query = sql`
    SELECT constraints.*, usage.*, foreign_table.relname AS foreign_table_name,
      foreign_column.attname AS foreign_column_name, foreign_namespace.nspname AS foreign_table_schema
    FROM information_schema.table_constraints constraints
      JOIN information_schema.key_column_usage usage
        ON constraints.constraint_catalog = usage.constraint_catalog
        AND constraints.constraint_schema = usage.constraint_schema
        AND constraints.constraint_name = usage.constraint_name
        AND constraints.table_schema = usage.table_schema
        AND constraints.table_name = usage.table_name
      LEFT JOIN pg_catalog.pg_namespace local_namespace
        ON local_namespace.nspname = constraints.table_schema
      LEFT JOIN pg_catalog.pg_class local_table
        ON local_table.relname = constraints.table_name
        AND local_table.relnamespace = local_namespace.oid
      LEFT JOIN pg_catalog.pg_constraint foreign_constraint
        ON foreign_constraint.conrelid = local_table.oid
        AND foreign_constraint.conname = constraints.constraint_name
        AND foreign_constraint.contype = 'f'
      LEFT JOIN pg_catalog.pg_class foreign_table
        ON foreign_table.oid = foreign_constraint.confrelid
      LEFT JOIN pg_catalog.pg_namespace foreign_namespace
        ON foreign_namespace.oid = foreign_table.relnamespace
      LEFT JOIN pg_catalog.pg_attribute foreign_column
        ON foreign_column.attrelid = foreign_constraint.confrelid
        AND foreign_column.attnum = foreign_constraint.confkey[usage.ordinal_position]
    WHERE constraints.table_name = ${table}
      AND constraints.table_schema = ${schema}
    ORDER BY usage.constraint_name, usage.ordinal_position
  `
  const constraintsList = await db.query(query)
  return constraintsList
}

export async function updateOne (db, sql, table, schema, input, primaryKeys, fieldsToRetrieve) {
  const pairs = Object.keys(input).map(key => {
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

export async function listEnumValues (db, sql, table, schema) {
  const query = sql`
    SELECT udt_name, enumlabel, column_name
    FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    JOIN information_schema.columns c on c.udt_name = t.typname
    WHERE table_name = ${table}
    AND table_schema = ${schema}
    ORDER BY column_name, e.enumsortorder;
    `
  return db.query(query)
}

export async function listViews (db, sql, schemas) {
  if (schemas) {
    const schemaList = sql.__dangerous__rawValue(schemas.map(s => `'${s}'`))
    const res = await db.query(sql`
    SELECT viewname, schemaname
    FROM pg_catalog.pg_views
    WHERE
      schemaname in (${schemaList})
    ORDER BY schemaname, viewname`)
    return res.map(r => ({ schema: r.schemaname, table: r.viewname, isView: true }))
  }
  const res = await db.query(sql`
    SELECT viewname, schemaname
    FROM pg_catalog.pg_views
    WHERE
      schemaname = current_schema()
    ORDER BY schemaname, viewname
  `)
  return res.map(r => ({ schema: r.schemaname, table: r.viewname, isView: true }))
}

export const hasILIKE = true
