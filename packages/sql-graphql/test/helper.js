'use strict'

// Needed to work with dates & postgresql
// See https://node-postgres.com/features/types/
process.env.TZ = 'UTC'

const connInfo = {}

if (!process.env.DB || process.env.DB === 'postgresql') {
  connInfo.connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  module.exports.isPg = true
} else if (process.env.DB === 'mariadb') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3307/graph'
  connInfo.poolSize = 10
  module.exports.isMysql = true
  module.exports.isMariaDB = true
} else if (process.env.DB === 'mysql') {
  connInfo.connectionString = 'mysql://root@127.0.0.1/graph'
  connInfo.poolSize = 10
  module.exports.isMysql = true
} else if (process.env.DB === 'mysql8') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3308/graph'
  connInfo.poolSize = 10
  module.exports.isMysql = true
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  module.exports.isSQLite = true
}

module.exports.connInfo = connInfo

module.exports.clear = async function (db, sql) {
  try {
    await db.query(sql`DROP TABLE editors`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE pages`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE categories`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE posts`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE simple_types`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE owners`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE users`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE versions`)
  } catch {
  }
  try {
    await db.query(sql`DROP TABLE graphs`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE books`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE authors`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE organizations`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE individuals`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP Type simple_enum`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE "myschema"."mytable"`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE "myschema"."template"`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA "myschema"`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE generated_test`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE enum_tests`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TYPE custom_enum`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE test4.books`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE test3.authors`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE test2.books`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE test1.authors`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test4`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test3`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test2`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test1`)
  } catch (err) {
  }
}
