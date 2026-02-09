import { deepStrictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should restrict access via interceptor', async t => {
  const configFile = join(fixturesDir, 'policies', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // These requests also go between applications. Calls from application-1 to application-2 (or reverse) are blocked
  {
    const { statusCode, body } = await request(url + '/application-1/interceptor/application-2')
    deepStrictEqual(statusCode, 500)
    deepStrictEqual(await body.json(), { error: 'Internal Server Error', message: 'fetch failed', statusCode: 500 })
  }

  {
    const { statusCode, body } = await request(url + '/application-2/interceptor/application-1')
    deepStrictEqual(statusCode, 500)
    deepStrictEqual(await body.json(), { error: 'Internal Server Error', message: 'fetch failed', statusCode: 500 })
  }

  // Other calls are allowed
  {
    const { statusCode, body } = await request(url + '/application-1/interceptor/application-3')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-3' })
  }

  {
    const { statusCode, body } = await request(url + '/application-2/interceptor/application-3')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-3' })
  }

  {
    const { statusCode, body } = await request(url + '/application-3/interceptor/application-1')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-1' })
  }

  {
    const { statusCode, body } = await request(url + '/application-3/interceptor/application-2')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-2' })
  }
})

test('should restrict access via messaging API', async t => {
  const configFile = join(fixturesDir, 'policies', 'platformatic.runtime.json')
  const server = await createRuntime(configFile)

  t.after(async () => {
    await server.close()
  })

  const url = await server.start()

  // These requests also go between applications. Calls from application-1 to application-2 (or reverse) are blocked
  {
    const { statusCode, body } = await request(url + '/application-1/messaging/application-2')
    deepStrictEqual(statusCode, 500)
    const { message } = await body.json()
    ok(
      message.includes('Communication channels are disabled between applications "application-1" and "application-2".')
    )
  }

  {
    const { statusCode, body } = await request(url + '/application-2/messaging/application-1')
    deepStrictEqual(statusCode, 500)
    const { message } = await body.json()
    ok(
      message.includes('Communication channels are disabled between applications "application-2" and "application-1".')
    )
  }

  // Other calls are allowed
  {
    const { statusCode, body } = await request(url + '/application-1/messaging/application-3')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-3' })
  }

  {
    const { statusCode, body } = await request(url + '/application-2/messaging/application-3')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-3' })
  }

  {
    const { statusCode, body } = await request(url + '/application-3/messaging/application-1')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-1' })
  }

  {
    const { statusCode, body } = await request(url + '/application-3/messaging/application-2')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { from: 'application-2' })
  }
})
