import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

test('numeric primary and referencing foreign keys are strings in REST output', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
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
    }
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  const openapi = app.swagger()
  strictEqual(openapi.components.schemas.Contact.properties.id.type, 'string')
  strictEqual(openapi.components.schemas.ContactInput.properties.id.type, 'integer')
  strictEqual(openapi.components.schemas.Registration.properties.id.type, 'string')
  strictEqual(openapi.components.schemas.Registration.properties.contactId.type, 'string')
  strictEqual(openapi.components.schemas.Registration.properties.contactCode.type, 'integer')
  strictEqual(openapi.components.schemas.RegistrationInput.properties.id.type, 'integer')
  strictEqual(openapi.components.schemas.RegistrationInput.properties.contactId.type, 'integer')
  strictEqual(openapi.components.schemas.RegistrationInput.properties.contactCode.type, 'integer')

  const contactResponse = await app.inject({
    method: 'POST',
    url: '/contacts',
    body: { externalCode: 42 }
  })
  strictEqual(contactResponse.statusCode, 200, contactResponse.body)
  deepStrictEqual(contactResponse.json(), { id: '1', externalCode: 42 })

  const registrationResponse = await app.inject({
    method: 'POST',
    url: '/registrations',
    body: { contactId: 1, contactCode: 42 }
  })
  strictEqual(registrationResponse.statusCode, 200, registrationResponse.body)
  deepStrictEqual(registrationResponse.json(), { id: '1', contactId: '1', contactCode: 42 })

  const getResponse = await app.inject({
    method: 'GET',
    url: '/registrations/1'
  })
  strictEqual(getResponse.statusCode, 200, getResponse.body)
  deepStrictEqual(getResponse.json(), { id: '1', contactId: '1', contactCode: 42 })
})
