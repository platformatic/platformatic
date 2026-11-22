import assert from 'assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig } from './helper.js'

test('should resolve openapi applications to the origin', async t => {
  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'service1',
          openapi: {
            file: join(import.meta.dirname, 'openapi', 'fixtures', 'schemas', 'users.json')
          }
        },
        {
          id: 'service2',
          openapi: {
            file: join(import.meta.dirname, 'openapi', 'fixtures', 'schemas', 'posts.json')
          }
        }
      ]
    }
  })

  await gateway.start({ listen: true })

  const applications = gateway.getApplication().platformatic.config.gateway.applications
  assert.equal(applications.length, 2)
  assert.equal(applications[0].id, 'service1')
  assert.equal(applications[0].origin, 'http://service1.plt.local')
  assert.equal(applications[1].id, 'service2')
  assert.equal(applications[1].origin, 'http://service2.plt.local')
})
