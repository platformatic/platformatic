/* globals platformatic */

import { withResolvers } from '@platformatic/utils'
import { deepStrictEqual, ok, rejects, throws } from 'node:assert'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { request } from 'undici'
import { createMockedLogger, createStackable, temporaryFolder } from './helper.js'

test('BaseStackable - should properly initialize', async t => {
  const stackable = createStackable({ serviceId: 'service' })
  deepStrictEqual(stackable.logger.level, 'trace')
})

test('BaseStackable - should properly setup globals', async t => {
  const stackable = createStackable(
    { serverConfig: {} },
    {
      current: {
        server: {
          logger: {
            level: 'info'
          }
        }
      }
    }
  )

  platformatic.setOpenapiSchema('openapi')
  platformatic.setGraphqlSchema('graphql')
  platformatic.setBasePath('basePath')

  deepStrictEqual(await stackable.getOpenapiSchema(), 'openapi')
  deepStrictEqual(await stackable.getGraphqlSchema(), 'graphql')
  deepStrictEqual(stackable.logger.level, 'info')
  deepStrictEqual(stackable.basePath, 'basePath')
})

test('BaseStackable - other getters', async t => {
  const stackable = createStackable(
    {},
    {
      current: { key1: 'value1' },
      env: { key2: 'value2' }
    }
  )

  stackable.url = 'URL'

  deepStrictEqual(stackable.getUrl(), 'URL')
  deepStrictEqual(await stackable.getConfig(), { key1: 'value1' })
  deepStrictEqual(await stackable.getEnv(), { key2: 'value2' })
  deepStrictEqual(await stackable.getInfo(), { type: 'base', version: '1.0.0' })
  deepStrictEqual(await stackable.collectMetrics(), { defaultMetrics: true, httpMetrics: false })
  deepStrictEqual(await stackable.getDispatchFunc(), stackable)
})

test('BaseStackable - getWatchConfig - disabled', async t => {
  const stackable = createStackable({}, { current: { watch: { enabled: false } } })

  deepStrictEqual(await stackable.getWatchConfig(), { enabled: false, path: temporaryFolder })
})

test('BaseStackable - getWatchConfig - disabled', async t => {
  const stackable = createStackable({}, { current: { watch: { enabled: true, allow: ['first'], ignore: ['second'] } } })

  deepStrictEqual(await stackable.getWatchConfig(), {
    allow: ['first'],
    enabled: true,
    path: temporaryFolder,
    ignore: ['second']
  })
})

test('BaseStackable - log - should properly log', async t => {
  const stackable = createStackable()

  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  await stackable.log({ message: 'MESSAGE 1' })
  await stackable.log({ message: 'MESSAGE 2', level: 'error' })

  deepStrictEqual(messages, [
    ['INFO', 'MESSAGE 1'],
    ['ERROR', 'MESSAGE 2']
  ])
})

test('BaseStackable - verifyOutputDirectory - throw an error', t => {
  const stackable = createStackable({ isProduction: true })

  throws(
    () => stackable.verifyOutputDirectory('/non/existent'),
    /Cannot access directory '\/non\/existent'. Please run the 'build' command before running in production mode./
  )
})

test('BaseStackable - verifyOutputDirectory - do not throw an error in development', async t => {
  const stackable = createStackable()

  stackable.verifyOutputDirectory('/non/existent')
})

test('BaseStackable - verifyOutputDirectory - do not throw on existing directories', async t => {
  const stackable = createStackable({ isProduction: true })

  stackable.verifyOutputDirectory(import.meta.dirname)
})

test('BaseStackable - buildWithCommand - should execute the requested command', async t => {
  const stackable = createStackable({ isProduction: true })
  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('./fixtures/print-cwd.js', import.meta.url))
  await stackable.buildWithCommand(['node', executablePath], import.meta.dirname)

  deepStrictEqual(messages, [
    ['DEBUG', `Executing "node ${executablePath}" ...`],
    ['ERROR', temporaryFolder]
  ])
})

test('BaseStackable - buildWithCommand - should handle exceptions', async t => {
  const stackable = createStackable({})
  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('./fixtures/invalid.js', import.meta.url))
  await rejects(
    () => stackable.buildWithCommand(`node ${executablePath}`, import.meta.dirname),
    /PLT_BASIC_NON_ZERO_EXIT_CODE/
  )

  deepStrictEqual(messages, [['DEBUG', `Executing "node ${executablePath}" ...`]])
})

test('BaseStackable - startCommand and stopCommand - should execute the requested command', async t => {
  const stackable = createStackable(
    {
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {}
    },
    {
      current: {
        application: { basePath: '/whatever' },
        watch: { enabled: true, allow: ['first'], ignore: ['second'] }
      }
    }
  )

  const executablePath = fileURLToPath(new URL('./fixtures/server.js', import.meta.url))
  await stackable.startWithCommand(`node ${executablePath}`)

  ok(stackable.url.startsWith('http://127.0.0.1:'))
  ok(!stackable.url.endsWith(':10000'))
  deepStrictEqual(stackable.subprocessConfig, { production: false })

  {
    const { statusCode, body: rawBody } = await request(stackable.url, {
      method: 'GET',
      path: '/'
    })
    deepStrictEqual(statusCode, 200)

    const body = await rawBody.json()
    deepStrictEqual(body, {
      basePath: '/whatever',
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      root: pathToFileURL(temporaryFolder).toString(),
      telemetry: {}
    })
  }

  await stackable.stopCommand()
})

test('BaseStackable - startCommand - should reject for non existing commands', async t => {
  const stackable = createStackable()

  await rejects(
    () => stackable.startWithCommand('non-existing-command'),
    /Cannot execute command "non-existing-command": executable not found/
  )
})

test('BaseStackable - startCommand - should kill the process on non-zero exit code', async t => {
  const stackable = createStackable()

  const { promise, resolve } = withResolvers()
  t.mock.method(process, 'exit', code => {
    resolve(code)
  })

  const executablePath = fileURLToPath(new URL('./fixtures/non-zero-exit.js', import.meta.url))
  await stackable.startWithCommand(`node ${executablePath}`)

  deepStrictEqual(await promise, 123)
})
