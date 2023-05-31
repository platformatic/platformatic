'use strict'

const { join } = require('path')
const { test } = require('tap')

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
  t.equal(services.length, 2)

  t.equal(services[0].id, 'service1')
  t.equal(services[0].origin, 'http://service1.plt.local')

  t.equal(services[1].id, 'service2')
  t.equal(services[1].origin, 'http://service2.plt.local')
})
