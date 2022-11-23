'use strict'

const { insertPrep } = require('./shared')
const shared = require('./mysql-shared')

function insertOne (db, sql, table, input, primaryKeys, fieldsToRetrieve) {
  const keysToSql = Object.keys(input).map((key) => sql.ident(key))
  const keys = sql.join(
    keysToSql,
    sql`, `
  )

  const valuesToSql = Object.keys(input).map((key) => {
    return sql.value(input[key])
  })
  const values = sql.join(
    valuesToSql,
    sql`, `
  )

  if (primaryKeys.length === 1 && input[primaryKeys[0].key] === undefined) {
    return db.tx(async function (db) {
      const insert = sql`
      INSERT INTO ${sql.ident(table)} (${keys})
      VALUES(${values})
    `
      await db.query(insert)

      const res2 = await db.query(sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${sql.ident(table)}
      WHERE ${sql.ident(primaryKeys[0].key)} = (
        SELECT last_insert_id()
      )
    `)

      return res2[0]
    })
  } else {
    const where = []
    for (const { key } of primaryKeys) {
      // TODO write a test that cover this
      /* istanbul ignore next */
      if (!input[key]) {
        throw new Error(`Missing value for primary key ${key}`)
      }
      where.push(sql`${sql.ident(key)} = ${input[key]}`)
    }

    return db.tx(async function (db) {
      const insert = sql`
      INSERT INTO ${sql.ident(table)} (${keys})
      VALUES(${values})
    `
      await db.query(insert)

      const res2 = await db.query(sql`
        SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
        FROM ${sql.ident(table)}
        WHERE ${sql.join(where, sql` AND `)}
      `)

      return res2[0]
    })
  }
}

function insertMany (db, sql, table, inputs, inputToFieldMap, primaryKeys, fieldsToRetrieve, fields) {
  return db.tx(async function (db) {
    const { keys, values } = insertPrep(inputs, inputToFieldMap, fields, sql)
    const insert = sql`
      insert into ${sql.ident(table)} (${keys})
      values ${sql.join(values, sql`, `)}
    `

    await db.query(insert)

    const orderBy = []
    for (const { key } of primaryKeys) {
      orderBy.push(sql`${sql.ident(key)} DESC`)
    }

    const res = await db.query(sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${sql.ident(table)}
      ORDER BY ${sql.join(orderBy, ',')}
      LIMIT ${inputs.length}
    `)

    // To make consistent with shared.insertMany
    res.sort(function (a, b) {
      let val = 0
      for (const { key } of primaryKeys) {
        val = a[key] - b[key]
        if (val !== 0) {
          return val
        }
      }
      // The following should never happen
      /* istanbul ignore next */
      return val
    })
    return res
  })
}

function deleteAll (db, sql, table, criteria, fieldsToRetrieve) {
  return db.tx(async function (db) {
    let selectQuery = sql`
      SELECT ${sql.join(fieldsToRetrieve, sql`, `)}
      FROM ${sql.ident(table)}
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
      DELETE FROM ${sql.ident(table)}
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
