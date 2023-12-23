'use strict'

const { clear, connInfo, isSQLite, isPg } = require('./helper')
const { test, only } = require('node:test')
const { deepEqual: same, equal, ok: pass } = require('node:assert')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { telemetry } = require('@platformatic/telemetry')
const fastify = require('fastify')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(10)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(10)
    );`)
  }
}

test('creates the spans for the graphql mutation', async (t) => {
  const app = fastify()

  await app.register(telemetry, {
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }

  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  equal(finishedSpans.length, 2)
  const graphqlSpan = finishedSpans[0]
  const httpSpan = finishedSpans[1]

  equal(httpSpan.name, 'POST /graphql')
  equal(httpSpan.attributes['http.request.method'], 'POST')
  equal(httpSpan.attributes['url.path'], '/graphql')
  equal(httpSpan.attributes['http.response.status_code'], 200)

  equal(graphqlSpan.name, 'mutation savePage')
  equal(graphqlSpan.attributes['graphql.operation.name'], 'savePage')
  equal(graphqlSpan.attributes['graphql.operation.type'], 'mutation')
  const document = graphqlSpan.attributes['graphql.document']
  const documentObj = JSON.parse(document)
  equal(documentObj.query, `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `)
})

// We skip this for sqllite because in sqlite it's HARD to have a resolver exception without a schema validation exception first.
test('creates the spans for errors', { skip: isSQLite }, async (t) => {
  const app = fastify()

  await app.register(telemetry, {
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  {
    // This will fail because the title is too long
    // (we neede to create a resolver error, not a schema error)
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Platformatic is cool!" }) {
              id
              title
            }
          }
         `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
  }

  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  equal(finishedSpans.length, 2)
  const graphqlSpan = finishedSpans[0]
  const httpSpan = finishedSpans[1]

  equal(httpSpan.name, 'POST /graphql')
  equal(httpSpan.attributes['http.request.method'], 'POST')
  equal(httpSpan.attributes['url.path'], '/graphql')
  equal(httpSpan.attributes['http.response.status_code'], 200)

  equal(graphqlSpan.name, 'mutation savePage')
  equal(graphqlSpan.attributes['graphql.operation.name'], 'savePage')
  equal(graphqlSpan.attributes['graphql.operation.type'], 'mutation')
  const document = graphqlSpan.attributes['graphql.document']
  const documentObj = JSON.parse(document)
  equal(documentObj.query, `
          mutation {
            savePage(input: { title: "Platformatic is cool!" }) {
              id
              title
            }
          }
         `)
  equal(graphqlSpan.status.code, 2)
  let expectedMessage
  if (isPg) {
    expectedMessage = 'value too long for type character varying(10)'
  } else if (isSQLite) {
    expectedMessage = 'Data too long for column \'title\' at row 1'
  } else {
    expectedMessage = "Data too long for column 'title' at row 1"
  }
  equal(graphqlSpan.status.message, expectedMessage)
})

only('don\'t wrap the schema types starting with __', async (t) => {
  const app = fastify()

  await app.register(telemetry, {
    serviceName: 'test-service',
    version: '1.0.0',
    exporter: {
      type: 'memory'
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  const schema = app.graphql.schema
  const schemaTypeMap = schema.getTypeMap()
  const types = Object.values(schemaTypeMap)
  const schemaTypes = types.filter(
    type => typeof type.getFields === 'function'
  )

  for (const schemaType of schemaTypes) {
    for (const [fieldName, field] of Object.entries(schemaType.getFields())) {
      if (field?.resolve?.__wrapped) {
        if (schemaType.name.startsWith('__')) {
          fail(`schemaType should not be wrapped ${schemaType.name}, ${fieldName}`)
        }
      }
    }
  }
})
