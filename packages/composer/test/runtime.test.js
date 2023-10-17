'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')

const { createComposer } = require('./helper')

test('should resolve service ids to the origin', async (t) => {
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
