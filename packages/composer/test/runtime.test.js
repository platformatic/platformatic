'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')

const { createComposer } = require('./helper')

test('should resolve openapi services to the origin', async (t) => {
  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'service1',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
            }
          },
          {
            id: 'service2',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
            }
          }
        ]
      }
    }
  )

  const services = composer.platformatic.config.composer.services
  assert.equal(services.length, 2)

  assert.equal(services[0].id, 'service1')
  assert.equal(services[0].origin, 'http://service1.plt.local')

  assert.equal(services[1].id, 'service2')
  assert.equal(services[1].origin, 'http://service2.plt.local')
})

test('should resolve graphql services to the origin', async (t) => {
  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin: 'http://graphql1.plt.local',
            graphql: true
          },
          {
            id: 'graphql2',
            origin: 'http://graphql2.plt.local',
            graphql: true
          }
        ]
      }
    }
  )

  const services = composer.platformatic.config.composer.services
  assert.equal(services.length, 2)

  assert.equal(services[0].id, 'graphql1')
  assert.equal(services[0].origin, 'http://graphql1.plt.local')

  assert.equal(services[1].id, 'graphql2')
  assert.equal(services[1].origin, 'http://graphql2.plt.local')
})

test('should resolve services that use opeanapi and/or graphql', async (t) => {
  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql',
            origin: 'http://graphql.plt.local',
            graphql: true
          },
          {
            id: 'openapi',
            origin: 'http://openapi.plt.local',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
            }
          },
          {
            id: 'openapi-and-graphql',
            origin: 'http://openapi-and-graphql.plt.local',
            openapi: {
              file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
            },
            graphql: true
          }
        ]
      }
    }
  )

  const services = composer.platformatic.config.composer.services
  assert.equal(services.length, 3)

  assert.equal(services[0].id, 'graphql')
  assert.equal(services[0].origin, 'http://graphql.plt.local')
  assert.equal(services[0].graphql, true)

  assert.equal(services[1].id, 'openapi')
  assert.equal(services[1].origin, 'http://openapi.plt.local')
  assert.ok(services[1].openapi)

  assert.equal(services[2].id, 'openapi-and-graphql')
  assert.equal(services[2].origin, 'http://openapi-and-graphql.plt.local')
  assert.ok(services[2].openapi)
  assert.ok(services[2].graphql)
})

// TODO configuration conflicts
// TODO routes conflicts
