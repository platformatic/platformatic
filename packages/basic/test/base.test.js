/* globals platformatic */

import { withResolvers } from '@platformatic/utils'
import { deepStrictEqual, ok, rejects, throws } from 'node:assert'
import { platform } from 'node:os'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { request } from 'undici'
import { createStackable, getExecutedCommandLogMessage, isWindows, temporaryFolder } from './helper.js'

const expectedLogger = {
  levels: {
    labels: {
      10: 'trace',
      20: 'debug',
      30: 'info',
      40: 'warn',
      50: 'error',
      60: 'fatal'
    },
    values: {
      debug: 20,
      error: 50,
      fatal: 60,
      info: 30,
      trace: 10,
      warn: 40
    }
  }
}

test('BaseStackable - should properly initialize', async t => {
  const stackable = await createStackable(t, { serviceId: 'service' })
  deepStrictEqual(stackable.logger.level, 'trace')
})

test('BaseStackable - should properly setup globals', async t => {
  const stackable = await createStackable(
    t,
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
  const stackable = await createStackable(
    t,
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
  deepStrictEqual(await stackable.getDispatchFunc(), stackable)
})

test('BaseStackable - getWatchConfig - disabled', async t => {
  const stackable = await createStackable(t, {}, { current: { watch: { enabled: false } } })

  deepStrictEqual(await stackable.getWatchConfig(), { enabled: false, path: temporaryFolder })
})

test('BaseStackable - getWatchConfig - disabled', async t => {
  const stackable = await createStackable(
    t,
    {},
    { current: { watch: { enabled: true, allow: ['first'], ignore: ['second'] } } }
  )

  deepStrictEqual(await stackable.getWatchConfig(), {
    allow: ['first'],
    enabled: true,
    path: temporaryFolder,
    ignore: ['second']
  })
})

test('BaseStackable - log - should properly log', async t => {
  const stackable = await createStackable(t)

  await stackable.log({ message: 'MESSAGE 1' })
  await stackable.log({ message: 'MESSAGE 2', level: 'error' })

  const messages = stackable.stdout.messages.map(JSON.parse)
  ok(messages[0].level === 30 && messages[0].msg === 'MESSAGE 1')
  ok(messages[1].level === 50 && messages[1].msg === 'MESSAGE 2')
})

test('BaseStackable - verifyOutputDirectory - throw an error', async t => {
  const stackable = await createStackable(t, { isProduction: true })

  throws(
    () => stackable.verifyOutputDirectory('/non/existent'),
    /Cannot access directory '\/non\/existent'. Please run the 'build' command before running in production mode./
  )
})

test('BaseStackable - verifyOutputDirectory - do not throw an error in development', async t => {
  const stackable = await createStackable(t)

  stackable.verifyOutputDirectory('/non/existent')
})

test('BaseStackable - verifyOutputDirectory - do not throw on existing directories', async t => {
  const stackable = await createStackable(t, { isProduction: true })

  stackable.verifyOutputDirectory(import.meta.dirname)
})

test('BaseStackable - buildWithCommand - should execute the requested command', async t => {
  const stackable = await createStackable(t, { isProduction: true })

  const executablePath = fileURLToPath(new URL('./fixtures/print-cwd.js', import.meta.url))
  await stackable.buildWithCommand(['node', executablePath], import.meta.dirname)

  ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(stackable.stderr.messages[0], temporaryFolder)
})

test('BaseStackable - buildWithCommand - should handle exceptions', async t => {
  const stackable = await createStackable(t, {})

  const executablePath = fileURLToPath(new URL('./fixtures/invalid.js', import.meta.url))
  await rejects(
    () => stackable.buildWithCommand(`node ${executablePath}`, import.meta.dirname),
    /PLT_BASIC_NON_ZERO_EXIT_CODE/
  )

  ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  ok(JSON.parse(stackable.stdout.messages[1]).err.message.startsWith(`Cannot find module '${executablePath}'`))
})

test('BaseStackable - buildWithCommand - should not inject the Platformatic code if asked to', async t => {
  const stackable = await createStackable(t, {})

  const executablePath = fileURLToPath(new URL('./fixtures/build-context.js', import.meta.url))
  await stackable.buildWithCommand(`node ${executablePath}`, import.meta.dirname)
  await stackable.buildWithCommand(`node ${executablePath}`, import.meta.dirname, { disableChildManager: true })

  ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(stackable.stdout.messages[1], 'INJECTED true')
  ok(stackable.stdout.messages[2].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(stackable.stdout.messages[3], 'INJECTED false')
})

test(
  'BaseStackable - buildWithCommand - should properly intercept output from non Node.js executables - /usr/bin/env',
  { skip: isWindows },
  async t => {
    const stackable = await createStackable(t, {})

    await stackable.buildWithCommand('/usr/bin/env', import.meta.dirname, { disableChildManager: true })

    ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage('/usr/bin/env')))
    ok(stackable.stdout.messages.slice(1).every(s => s.match(/[a-z0-9-_]=.+/i)))
  }
)

test(
  'BaseStackable - buildWithCommand - should properly intercept output from non Node.js executables - /bin/bash',
  { skip: isWindows },
  async t => {
    const stackable = await createStackable(t, {})

    const executablePath = fileURLToPath(new URL('./fixtures/build-context.sh', import.meta.url))
    await stackable.buildWithCommand(executablePath, import.meta.dirname, { disableChildManager: true })

    ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage(executablePath)))
    deepStrictEqual(
      stackable.stdout.messages.slice(1).map(l => l.trim()),
      [`STDOUT=${temporaryFolder}`]
    )
    deepStrictEqual(
      stackable.stderr.messages.map(l => l.trim()),
      [`STDERR=${temporaryFolder}`]
    )
  }
)

test(
  'BaseStackable - buildWithCommand - should properly change the working directory',
  { skip: isWindows },
  async t => {
    const stackable = await createStackable(t, {})

    const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))
    const executablePath = fileURLToPath(new URL('./fixtures/chdir-and-run.sh', import.meta.url))
    await stackable.buildWithCommand(executablePath, import.meta.dirname)

    ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage(executablePath)))
    deepStrictEqual(
      stackable.stdout.messages.slice(1).map(l => l.trim()),
      [`STDOUT=${fixturesDir}`]
    )
    deepStrictEqual(
      stackable.stderr.messages.map(l => l.trim()),
      [`STDERR=${fixturesDir}`]
    )
  }
)

test('BaseStackable - startCommand and stopCommand - should execute the requested command', async t => {
  const stackable = await createStackable(
    t,
    {
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {},
      runtimeConfig: {
        gracefulShutdown: {
          runtime: 1000,
          service: 1000
        }
      }
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
      config: {
        application: {
          basePath: '/whatever'
        },
        watch: {
          allow: ['first'],
          enabled: true,
          ignore: ['second']
        }
      },
      basePath: '/whatever',
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      root: pathToFileURL(temporaryFolder).toString(),
      telemetryConfig: {},
      isEntrypoint: true,
      runtimeBasePath: null,
      wantsAbsoluteUrls: false,
      exitOnUnhandledErrors: true,
      logger: expectedLogger
    })
  }

  await stackable.stopCommand()
})

test('BaseStackable - should import and setup open telemetry HTTP instrumentation', async t => {
  const stackable = await createStackable(
    t,
    {
      serviceId: 'test-service-id',
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {
        serviceName: 'test-telemetry',
        exporter: {
          type: 'otlp',
          options: {
            url: 'http://127.0.0.1:3044/risk-service/v1/traces'
          }
        }
      },
      runtimeConfig: {
        gracefulShutdown: {
          runtime: 1000,
          service: 1000
        }
      }
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
      config: {
        application: {
          basePath: '/whatever'
        },
        watch: {
          allow: ['first'],
          enabled: true,
          ignore: ['second']
        }
      },
      serviceId: 'test-service-id',
      basePath: '/whatever',
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      root: pathToFileURL(temporaryFolder).toString(),
      telemetryConfig: {
        serviceName: 'test-telemetry',
        exporter: {
          type: 'otlp',
          options: {
            url: 'http://127.0.0.1:3044/risk-service/v1/traces'
          }
        }
      },
      isEntrypoint: true,
      runtimeBasePath: null,
      wantsAbsoluteUrls: false,
      exitOnUnhandledErrors: true,
      logger: expectedLogger
    })
  }

  await stackable.stopCommand()
})

test(
  'BaseStackable - startCommand - should reject for non existing commands',
  { skip: platform() === 'win32' },
  async t => {
    const stackable = await createStackable(t)

    await rejects(
      () => stackable.startWithCommand('non-existing-command'),
      /Cannot execute command "non-existing-command": executable not found/
    )
  }
)

test('BaseStackable - startCommand - should kill the process on non-zero exit code', async t => {
  const stackable = await createStackable(t)

  const { promise, resolve } = withResolvers()
  t.mock.method(process, 'exit', code => {
    resolve(code)
  })

  const executablePath = fileURLToPath(new URL('./fixtures/non-zero-exit.js', import.meta.url))
  await stackable.startWithCommand(`node ${executablePath}`)

  deepStrictEqual(await promise, 123)
})

test('BaseStackable - stopCommand - should forcefully exit the process if it doesnt exit within the allowed timeout', async t => {
  const stackable = await createStackable(
    t,
    {
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {},
      runtimeConfig: {
        gracefulShutdown: {
          runtime: 10,
          service: 10
        }
      }
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
    body.events = undefined
    deepStrictEqual(body, {
      config: {
        application: {
          basePath: '/whatever'
        },
        watch: {
          allow: ['first'],
          enabled: true,
          ignore: ['second']
        }
      },
      basePath: '/whatever',
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      root: pathToFileURL(temporaryFolder).toString(),
      telemetryConfig: {},
      isEntrypoint: true,
      runtimeBasePath: null,
      wantsAbsoluteUrls: false,
      exitOnUnhandledErrors: true,
      events: undefined,
      logger: expectedLogger
    })
  }

  await stackable.stopCommand()
})

test('BaseStackable - spawn - should handle chained commands', { skip: isWindows }, async t => {
  const stackable = await createStackable(t)

  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const testFile1 = path.join(temporaryFolder, 'test-file-1.txt')
  const testFile2 = path.join(temporaryFolder, 'test-file-2.txt')

  try {
    await fs.unlink(testFile1).catch(() => {})
    await fs.unlink(testFile2).catch(() => {})

    const chainedCommand = `touch ${testFile1} && touch ${testFile2}`
    await stackable.buildWithCommand(chainedCommand, temporaryFolder, { disableChildManager: true })

    const file1Exists = await fs
      .access(testFile1)
      .then(() => true)
      .catch(() => false)
    const file2Exists = await fs
      .access(testFile2)
      .then(() => true)
      .catch(() => false)

    ok(stackable.stdout.messages[0].includes(getExecutedCommandLogMessage(chainedCommand)))
    ok(file1Exists, 'First command in chain did not execute')
    ok(file2Exists, 'Second command in chain did not execute')

    await fs.unlink(testFile1).catch(() => {})
    await fs.unlink(testFile2).catch(() => {})

    const semicolonCommand = `touch ${testFile1}; touch ${testFile2}`
    await stackable.buildWithCommand(semicolonCommand, temporaryFolder, { disableChildManager: true })

    const file1ExistsAgain = await fs
      .access(testFile1)
      .then(() => true)
      .catch(() => false)
    const file2ExistsAgain = await fs
      .access(testFile2)
      .then(() => true)
      .catch(() => false)

    ok(stackable.stdout.messages.some(msg => msg.includes(getExecutedCommandLogMessage(semicolonCommand))))
    ok(file1ExistsAgain, 'First command with semicolon did not execute')
    ok(file2ExistsAgain, 'Second command with semicolon did not execute')
  } finally {
    await fs.unlink(testFile1).catch(() => {})
    await fs.unlink(testFile2).catch(() => {})
  }
})
