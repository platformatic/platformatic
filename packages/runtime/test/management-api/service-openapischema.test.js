import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { isatty } from 'tty'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get application openapi schema', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/applications/service-1/openapi-schema'
  })

  strictEqual(statusCode, 200)

  const openapiSchema = await body.json()

  const logger = {}
  if (isatty(1) && !logger.transport) {
    logger.transport = {
      target: 'pino-pretty'
    }
  }

  deepStrictEqual(openapiSchema, {
    openapi: '3.0.3',
    info: {
      title: 'Platformatic',
      description: 'This is a service built on top of Platformatic',
      version: '1.0.0'
    },
    servers: [
      {
        url: '/'
      }
    ],
    components: {
      schemas: {}
    },
    paths: {
      '/hello': {
        get: {
          responses: {
            200: {
              description: 'Default Response'
            }
          }
        }
      },
      '/large-logs': {
        get: {
          responses: {
            200: {
              description: 'Default Response'
            }
          }
        }
      }
    }
  })
})
