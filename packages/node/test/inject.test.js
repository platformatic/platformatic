import { ok } from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  getLogsFromFile,
  LOGS_TIMEOUT,
  prepareRuntimeWithServices,
  setFixturesDir,
  sleep,
  updateFile,
  verifyJSONViaHTTP
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should inject request via IPC even if a server is started', async t => {
  const { root, runtime, url } = await prepareRuntimeWithServices(
    t,
    'node-no-configuration-composer-with-prefix',
    false,
    'js',
    '/frontend',
    undefined,
    async root => {
      await updateFile(resolve(root, 'platformatic.runtime.json'), contents => {
        const json = JSON.parse(contents)
        json.logger.level = 'trace'
        return JSON.stringify(json, null, 2)
      })

      await writeFile(
        resolve(root, 'services/frontend/platformatic.application.json'),
        JSON.stringify({
          $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.0.0.json',
          logger: {
            level: 'trace'
          }
        }),
        'utf-8'
      )
    }
  )

  const info = await runtime.getServiceMeta('frontend')
  ok(info.composer.url)

  // Close the server so that we can verify the IPC injection
  await runtime.sendCommandToService('frontend', 'closeServer')

  await verifyJSONViaHTTP(url, '/frontend/inject', 200, { socket: false })

  // Wait for logs to be flushed
  await sleep(LOGS_TIMEOUT)
  const logs = await getLogsFromFile(root)
  ok(logs.map(m => m.msg).includes('injecting via light-my-request'))
})

test('should inject request via the HTTP port if asked to', async t => {
  const { root, runtime, url } = await prepareRuntimeWithServices(
    t,
    'node-no-configuration-composer-with-prefix',
    false,
    'js',
    '/frontend',
    undefined,
    async root => {
      await updateFile(resolve(root, 'platformatic.runtime.json'), contents => {
        const json = JSON.parse(contents)
        json.logger.level = 'trace'
        return JSON.stringify(json, null, 2)
      })

      await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
        const json = JSON.parse(contents)
        json.server = { logger: { level: 'fatal' } }
        return JSON.stringify(json, null, 2)
      })

      await writeFile(
        resolve(root, 'services/frontend/platformatic.application.json'),
        JSON.stringify({
          $schema: 'https://schemas.platformatic.dev/@platformatic/node/2.0.0.json',
          logger: {
            level: 'trace'
          },
          node: {
            dispatchViaHttp: true
          }
        }),
        'utf-8'
      )
    }
  )

  const info = await runtime.getServiceMeta('frontend')
  ok(info.composer.url)

  await verifyJSONViaHTTP(url, '/frontend/inject', 200, { socket: true })

  // Wait for logs to be flushed
  await sleep(LOGS_TIMEOUT)
  const logs = await getLogsFromFile(root)
  ok(!logs.map(m => m.msg).includes('injecting via light-my-request'))

  // To double verify it, close the HTTP server and verify we get a connection refused
  await runtime.sendCommandToService('frontend', 'closeServer')

  await verifyJSONViaHTTP(url, '/frontend/inject', 500, content => {
    ok(content.message.includes('ECONNREFUSED'))
  })
})
