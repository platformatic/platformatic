import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should stop application by application id', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  {
    const applicationDetails = await app.getApplicationDetails('service-1')
    strictEqual(applicationDetails.status, 'started')
  }

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
    await client.close()
    await Promise.all([app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/applications/service-1/stop'
  })
  await body.text()

  strictEqual(statusCode, 200)

  {
    const applicationDetails = await app.getApplicationDetails('service-1', true)
    strictEqual(applicationDetails.status, 'stopped')
  }
})

test('should start stopped application by application id', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  await app.stopApplication('service-1')

  {
    const applicationDetails = await app.getApplicationDetails('service-1', true)
    strictEqual(applicationDetails.status, 'stopped')
  }

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
    await client.close()
    await Promise.all([app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/applications/service-1/start'
  })
  await body.text()

  strictEqual(statusCode, 200)

  {
    const applicationDetails = await app.getApplicationDetails('service-1')
    strictEqual(applicationDetails.status, 'started')
  }
})

test('should proxy request to the application', async t => {
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
    await client.close()

    await Promise.all([app.close()])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/applications/service-2/proxy/hello'
  })

  strictEqual(statusCode, 200)

  const data = await body.json()
  deepStrictEqual(data, { service: 'service-2' })
})
