import { readFile } from 'fs/promises'
import { ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { command, isFileAccessible } from '../index.js'
import { moveToTmpdir } from './helper.js'

test('retry-request', async () => {
  const dir = await moveToTmpdir(after)

  const mockDispatcher = new MockAgent({ keepAliveTimeout: 10, keepAliveMaxTimeout: 10 })

  mockDispatcher.disableNetConnect()

  setGlobalDispatcher(mockDispatcher)

  // This is the endpoint the CLI will try to call
  const mockPool = mockDispatcher.get('http://mock.platformatic.dev')

  // We are going to simulate a network failure first, then a success.
  // The retry interceptor should handle this.
  mockPool.intercept({ path: '/documentation/json' })
    .reply(500, 'Internal Server Error') // First attempt fails

  mockPool.intercept({ path: '/documentation/json' })
    .reply(200, { // Second attempt succeeds
      openapi: '3.0.3',
      info: {
        title: 'Platformatic DB',
        description: 'Testing HTTP REST retry',
        version: '1.0.0'
      },
      paths: {
        '/hello': {
          get: {
            operationId: 'getRetry',
            responses: { 200: { description: 'Default Response' } }
          }
        }
      }
    })

  await command([
    'http://mock.platformatic.dev',
    '--name', 'full',
    '--validate-response',
    '--optional-headers', 'headerId',
    '--full',
    '--retry-timeout-ms', '10'
  ])

  ok(await isFileAccessible(join(dir, 'full', 'full.js')), 'Implementation file should be created')
  ok(await isFileAccessible(join(dir, 'full', 'full.d.ts')), 'Type definition file should be created')

  const typeFile = join(dir, 'full', 'full.d.ts')
  const data = await readFile(typeFile, 'utf-8')

  ok(data.includes('export type GetRetryRequest ='), 'Should contain GetRetryRequest type')
  ok(data.includes('export type GetRetryResponseOK = unknown'), 'Should contain GetRetryResponseOK type')
})
