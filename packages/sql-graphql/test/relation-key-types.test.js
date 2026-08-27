import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { deepEqual as same, equal } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

async function createApp (t, usePrimaryKeySqlType) {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    usePrimaryKeySqlType,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE contacts (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            external_code INTEGER NOT NULL UNIQUE
          );
          CREATE TABLE registrations (
            id INTEGER PRIMARY KEY AUTO_INCREMENT,
            contact_id INTEGER NOT NULL,
            contact_code INTEGER NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts(id),
            FOREIGN KEY (contact_code) REFERENCES contacts(external_code)
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE contacts (
            id INTEGER PRIMARY KEY,
            external_code INTEGER NOT NULL UNIQUE
          );
          CREATE TABLE registrations (
            id INTEGER PRIMARY KEY,
            contact_id INTEGER NOT NULL REFERENCES contacts(id),
            contact_code INTEGER NOT NULL REFERENCES contacts(external_code)
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE contacts (
            id SERIAL PRIMARY KEY,
            external_code INTEGER NOT NULL UNIQUE
          );
          CREATE TABLE registrations (
            id SERIAL PRIMARY KEY,
            contact_id INTEGER NOT NULL REFERENCES contacts(id),
            contact_code INTEGER NOT NULL REFERENCES contacts(external_code)
          );
        `)
      }

      await db.query(sql`INSERT INTO contacts (external_code) VALUES (42);`)
      await db.query(sql`INSERT INTO registrations (contact_id, contact_code) VALUES (1, 42);`)
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())
  await app.ready()
  return app
}

async function query (app) {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `{
        registrations {
          id
          contact { id externalCode }
          contactCode { id externalCode }
        }
      }`
    }
  })
  equal(res.statusCode, 200, res.body)
  return res.json()
}

// A foreign key pointing at a UNIQUE column that is not a primary key: the
// referenced column is not stringified, so the loader must not stringify the key
// it looks it up with.
test('relations to a non primary key column resolve', async t => {
  const app = await createApp(t, false)
  const { data, errors } = await query(app)

  same(errors, undefined)
  same(data.registrations, [
    {
      id: '1',
      contact: { id: '1', externalCode: 42 },
      contactCode: { id: '1', externalCode: 42 }
    }
  ])
})

test('relations resolve with usePrimaryKeySqlType', async t => {
  const app = await createApp(t, true)
  const { data, errors } = await query(app)

  same(errors, undefined)
  // GraphQL exposes keys as ID, which serializes to a string whatever the mapper
  // returns, so the output is the same as with the option turned off.
  same(data.registrations, [
    {
      id: '1',
      contact: { id: '1', externalCode: 42 },
      contactCode: { id: '1', externalCode: 42 }
    }
  ])
})
