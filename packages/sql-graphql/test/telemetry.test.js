import sqlMapper from '@platformatic/sql-mapper'
import { telemetry } from '@platformatic/telemetry'
import fastify from 'fastify'
import { equal, fail, ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isPg, isSQLite } from './helper.js'

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

const getSpanPerType = (spans, type = 'http') => {
  let attibuteToLookFor
  if (type === 'graphql') {
    attibuteToLookFor = 'graphql.document'
  } else if (type === 'db') {
    attibuteToLookFor = 'db.system'
  } else if (type === 'http') {
    attibuteToLookFor = 'url.path'
  } else {
    throw new Error(`Type ${type} not supported`)
  }
  return spans.find(span => span.attributes[attibuteToLookFor])
}

test('creates the spans for the graphql mutation', async t => {
  const app = fastify()

  await app.register(telemetry, {
    applicationName: 'test-service',
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
    const ress = res.json()
    same(
      ress,
      {
        data: {
          savePage: {
            id: 1,
            title: 'Hello'
          }
        }
      },
      'savePage response'
    )
  }

  const { exporters } = app.openTelemetry
  const finishedSpans = exporters[0].getFinishedSpans()
  const graphqlSpan = getSpanPerType(finishedSpans, 'graphql')
  const httpSpan = getSpanPerType(finishedSpans, 'http')

  equal(httpSpan.name, 'POST /graphql')
  equal(httpSpan.attributes['http.request.method'], 'POST')
  equal(httpSpan.attributes['http.route'], '/graphql')
  equal(httpSpan.attributes['url.path'], '/graphql')
  equal(httpSpan.attributes['http.response.status_code'], 200)

  equal(graphqlSpan.name, 'mutation savePage')
  equal(graphqlSpan.attributes['graphql.operation.name'], 'savePage')
  equal(graphqlSpan.attributes['graphql.operation.type'], 'mutation')
  const document = graphqlSpan.attributes['graphql.document']
  const documentObj = JSON.parse(document)
  equal(
    documentObj.query,
    `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `
  )
})

// We skip this for sqllite because in sqlite it's HARD to have a resolver exception without a schema validation exception first.
test('creates the spans for errors', { skip: isSQLite }, async t => {
  const app = fastify()

  await app.register(telemetry, {
    applicationName: 'test-service',
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
  equal(finishedSpans.length, 3)
  const graphqlSpan = getSpanPerType(finishedSpans, 'graphql')
  const httpSpan = getSpanPerType(finishedSpans, 'http')

  equal(httpSpan.name, 'POST /graphql')
  equal(httpSpan.attributes['http.request.method'], 'POST')
  equal(httpSpan.attributes['url.path'], '/graphql')
  equal(httpSpan.attributes['http.response.status_code'], 200)

  equal(graphqlSpan.name, 'mutation savePage')
  equal(graphqlSpan.attributes['graphql.operation.name'], 'savePage')
  equal(graphqlSpan.attributes['graphql.operation.type'], 'mutation')
  const document = graphqlSpan.attributes['graphql.document']
  const documentObj = JSON.parse(document)
  equal(
    documentObj.query,
    `
          mutation {
            savePage(input: { title: "Platformatic is cool!" }) {
              id
              title
            }
          }
         `
  )
  equal(graphqlSpan.status.code, 2)
  let expectedMessage
  if (isPg) {
    expectedMessage = 'value too long for type character varying(10)'
  } else if (isSQLite) {
    expectedMessage = "Data too long for column 'title' at row 1"
  } else {
    expectedMessage = "Data too long for column 'title' at row 1"
  }
  equal(graphqlSpan.status.message, expectedMessage)
})

test("don't wrap the schema types starting with __", async t => {
  const app = fastify()

  await app.register(telemetry, {
    applicationName: 'test-service',
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
  const schemaTypes = types.filter(type => typeof type.getFields === 'function')

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
