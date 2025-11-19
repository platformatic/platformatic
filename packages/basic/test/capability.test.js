/* globals platformatic */

import { kMetadata } from '@platformatic/foundation'
import { deepStrictEqual, ok, rejects, throws } from 'node:assert'
import { platform } from 'node:os'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { request } from 'undici'
import { create, getExecutedCommandLogMessage, isWindows, temporaryFolder } from './helper.js'

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

test('BaseCapability - should properly initialize', async t => {
  const capability = await create(t, { applicationId: 'application' })
  deepStrictEqual(capability.logger.level, 'trace')
})

test('BaseCapability - should properly setup globals', async t => {
  const capability = await create(
    t,
    { serverConfig: {} },
    {
      server: {
        logger: {
          level: 'info'
        }
      }
    }
  )

  platformatic.setOpenapiSchema('openapi')
  platformatic.setGraphqlSchema('graphql')
  platformatic.setBasePath('basePath')

  deepStrictEqual(await capability.getOpenapiSchema(), 'openapi')
  deepStrictEqual(await capability.getGraphqlSchema(), 'graphql')
  deepStrictEqual(capability.logger.level, 'info')
  deepStrictEqual(capability.basePath, 'basePath')
})

test('BaseCapability - other getters', async t => {
  const capability = await create(
    t,
    {},
    {
      key1: 'value1',
      [kMetadata]: { env: { key2: 'value2' } }
    }
  )

  capability.url = 'URL'

  deepStrictEqual(capability.getUrl(), 'URL')
  deepStrictEqual(await capability.getConfig(), { key1: 'value1' })
  deepStrictEqual(await capability.getEnv(), { key2: 'value2' })
  deepStrictEqual(await capability.getInfo(), { dependencies: [], type: 'base', version: '1.0.0' })
  deepStrictEqual(await capability.getDispatchFunc(), capability)
})

test('BaseCapability - getWatchConfig - disabled', async t => {
  const capability = await create(t, {}, { watch: { enabled: false } })

  deepStrictEqual(await capability.getWatchConfig(), { enabled: false, path: temporaryFolder })
})

test('BaseCapability - getWatchConfig - disabled', async t => {
  const capability = await create(t, {}, { watch: { enabled: true, allow: ['first'], ignore: ['second'] } })

  deepStrictEqual(await capability.getWatchConfig(), {
    allow: ['first'],
    enabled: true,
    path: temporaryFolder,
    ignore: ['second']
  })
})

test('BaseCapability - log - should properly log', async t => {
  const capability = await create(t)

  await capability.log({ message: 'MESSAGE 1' })
  await capability.log({ message: 'MESSAGE 2', level: 'error' })

  const messages = capability.stdout.messages.map(JSON.parse)
  ok(messages[0].level === 30 && messages[0].msg === 'MESSAGE 1')
  ok(messages[1].level === 50 && messages[1].msg === 'MESSAGE 2')
})

test('BaseCapability - verifyOutputDirectory - throw an error', async t => {
  const capability = await create(t, { isProduction: true })

  throws(
    () => capability.verifyOutputDirectory('/non/existent'),
    /Cannot access directory '\/non\/existent'. Please run the 'build' command before running in production mode./
  )
})

test('BaseCapability - verifyOutputDirectory - do not throw an error in development', async t => {
  const capability = await create(t)

  capability.verifyOutputDirectory('/non/existent')
})

test('BaseCapability - verifyOutputDirectory - do not throw on existing directories', async t => {
  const capability = await create(t, { isProduction: true })

  capability.verifyOutputDirectory(import.meta.dirname)
})

test('BaseCapability - buildWithCommand - should execute the requested command', async t => {
  const capability = await create(t, { isProduction: true })

  const executablePath = fileURLToPath(new URL('./fixtures/print-cwd.js', import.meta.url))
  await capability.buildWithCommand(['node', executablePath], import.meta.dirname)

  ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(capability.stderr.messages[0], temporaryFolder)
})

test('BaseCapability - buildWithCommand - should handle exceptions', async t => {
  const capability = await create(t, {})

  const executablePath = fileURLToPath(new URL('./fixtures/invalid.js', import.meta.url))
  await rejects(
    () => capability.buildWithCommand(`node ${executablePath}`, import.meta.dirname),
    /PLT_BASIC_NON_ZERO_EXIT_CODE/
  )

  ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  ok(JSON.parse(capability.stdout.messages[1]).err.message.startsWith(`Cannot find module '${executablePath}'`))
})

test('BaseCapability - buildWithCommand - should not inject the Platformatic code if asked to', async t => {
  const capability = await create(t, {})

  const executablePath = fileURLToPath(new URL('./fixtures/build-context.js', import.meta.url))
  await capability.buildWithCommand(`node ${executablePath}`, import.meta.dirname)
  await capability.buildWithCommand(`node ${executablePath}`, import.meta.dirname, { disableChildManager: true })

  ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(capability.stdout.messages[1], 'INJECTED true')
  ok(capability.stdout.messages[2].includes(getExecutedCommandLogMessage(`node ${executablePath}`)))
  deepStrictEqual(capability.stdout.messages[3], 'INJECTED false')
})

test(
  'BaseCapability - buildWithCommand - should properly intercept output from non Node.js executables - /usr/bin/env',
  { skip: isWindows },
  async t => {
    const capability = await create(t, {})

    await capability.buildWithCommand('/usr/bin/env', import.meta.dirname, { disableChildManager: true })

    ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage('/usr/bin/env')))
    ok(capability.stdout.messages.slice(1).every(s => s.match(/[a-z0-9-_]=.+/i)))
  }
)

test(
  'BaseCapability - buildWithCommand - should properly intercept output from non Node.js executables - /bin/bash',
  { skip: isWindows },
  async t => {
    const capability = await create(t, {})

    const executablePath = fileURLToPath(new URL('./fixtures/build-context.sh', import.meta.url))
    await capability.buildWithCommand(executablePath, import.meta.dirname, { disableChildManager: true })

    ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(executablePath)))
    deepStrictEqual(
      capability.stdout.messages.slice(1).map(l => l.trim()),
      [`STDOUT=${temporaryFolder}`]
    )
    deepStrictEqual(
      capability.stderr.messages.map(l => l.trim()),
      [`STDERR=${temporaryFolder}`]
    )
  }
)

test(
  'BaseCapability - buildWithCommand - should properly change the working directory',
  { skip: isWindows },
  async t => {
    const capability = await create(t, {})

    const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))
    const executablePath = fileURLToPath(new URL('./fixtures/chdir-and-run.sh', import.meta.url))
    await capability.buildWithCommand(executablePath, import.meta.dirname)

    ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(executablePath)))
    deepStrictEqual(
      capability.stdout.messages.slice(1).map(l => l.trim()),
      [`STDOUT=${fixturesDir}`]
    )
    deepStrictEqual(
      capability.stderr.messages.map(l => l.trim()),
      [`STDERR=${fixturesDir}`]
    )
  }
)

test('BaseCapability - startCommand and stopCommand - should execute the requested command', async t => {
  const capability = await create(
    t,
    {
      applicationId: 'application',
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {},
      runtimeConfig: {
        gracefulShutdown: {
          runtime: 1000,
          application: 1000
        }
      }
    },
    {
      application: { basePath: '/whatever' },
      watch: { enabled: true, allow: ['first'], ignore: ['second'] }
    }
  )

  const executablePath = fileURLToPath(new URL('./fixtures/server.js', import.meta.url))
  await capability.startWithCommand(`node ${executablePath}`)

  ok(capability.url.startsWith('http://127.0.0.1:'))
  ok(!capability.url.endsWith(':10000'))
  deepStrictEqual(capability.subprocessConfig, { production: false })

  {
    const { statusCode, body: rawBody } = await request(capability.url, {
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
      applicationId: 'application',
      workerId: 0,
      basePath: '/whatever',
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      additionalServerOptions: {},
      root: pathToFileURL(temporaryFolder).toString(),
      telemetryConfig: {},
      isEntrypoint: true,
      runtimeBasePath: null,
      wantsAbsoluteUrls: false,
      exitOnUnhandledErrors: true,
      logger: expectedLogger
    })
  }

  await capability.stopCommand()
})

test('BaseCapability - should import and setup open telemetry HTTP instrumentation', async t => {
  const capability = await create(
    t,
    {
      applicationId: 'test-application-id',
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {
        applicationName: 'test-telemetry',
        exporter: {
          type: 'otlp',
          options: {
            url: 'http://127.0.0.1:3044/risk-application/v1/traces'
          }
        }
      },
      runtimeConfig: {
        gracefulShutdown: {
          runtime: 1000,
          application: 1000
        }
      }
    },
    {
      application: { basePath: '/whatever' },
      watch: { enabled: true, allow: ['first'], ignore: ['second'] }
    }
  )

  const executablePath = fileURLToPath(new URL('./fixtures/server.js', import.meta.url))
  await capability.startWithCommand(`node ${executablePath}`)

  ok(capability.url.startsWith('http://127.0.0.1:'))
  ok(!capability.url.endsWith(':10000'))
  deepStrictEqual(capability.subprocessConfig, { production: false })

  {
    const { statusCode, body: rawBody } = await request(capability.url, {
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
      applicationId: 'test-application-id',
      workerId: 0,
      basePath: '/whatever',
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      additionalServerOptions: {},
      root: pathToFileURL(temporaryFolder).toString(),
      telemetryConfig: {
        applicationName: 'test-telemetry',
        exporter: {
          type: 'otlp',
          options: {
            url: 'http://127.0.0.1:3044/risk-application/v1/traces'
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

  await capability.stopCommand()
})

test(
  'BaseCapability - startCommand - should reject for non existing commands',
  { skip: platform() === 'win32' },
  async t => {
    const capability = await create(t)

    await rejects(
      () => capability.startWithCommand('non-existing-command'),
      /Cannot execute command "non-existing-command": executable not found/
    )
  }
)

test('BaseCapability - startCommand - should kill the process on non-zero exit code', async t => {
  const capability = await create(t)

  const { promise, resolve } = Promise.withResolvers()
  t.mock.method(process, 'exit', code => {
    resolve(code)
  })

  const executablePath = fileURLToPath(new URL('./fixtures/non-zero-exit.js', import.meta.url))
  await capability.startWithCommand(`node ${executablePath}`)

  deepStrictEqual(await promise, 123)
})

test('BaseCapability - stopCommand - should forcefully exit the process if it doesnt exit within the allowed timeout', async t => {
  const capability = await create(
    t,
    {
      applicationId: 'application',
      isEntrypoint: true,
      serverConfig: {
        hostname: '127.0.0.1',
        port: 0
      },
      telemetryConfig: {},
      runtimeConfig: {
        gracefulShutdown: {
          runtime: 10,
          application: 10
        }
      }
    },
    {
      application: { basePath: '/whatever' },
      watch: { enabled: true, allow: ['first'], ignore: ['second'] }
    }
  )

  const executablePath = fileURLToPath(new URL('./fixtures/server.js', import.meta.url))
  await capability.startWithCommand(`node ${executablePath}`)

  ok(capability.url.startsWith('http://127.0.0.1:'))
  ok(!capability.url.endsWith(':10000'))
  deepStrictEqual(capability.subprocessConfig, { production: false })

  {
    const { statusCode, body: rawBody } = await request(capability.url, {
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
      applicationId: 'application',
      workerId: 0,
      host: '127.0.0.1',
      logLevel: 'trace',
      port: 0,
      additionalServerOptions: {},
      root: pathToFileURL(temporaryFolder).toString(),
      telemetryConfig: {},
      isEntrypoint: true,
      runtimeBasePath: null,
      wantsAbsoluteUrls: false,
      events: undefined,
      exitOnUnhandledErrors: true,
      logger: expectedLogger
    })
  }

  await capability.stopCommand()
})

test('BaseCapability - spawn - should handle chained commands', { skip: isWindows }, async t => {
  const capability = await create(t)

  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const testFile1 = path.join(temporaryFolder, 'test-file-1.txt')
  const testFile2 = path.join(temporaryFolder, 'test-file-2.txt')

  try {
    await fs.unlink(testFile1).catch(() => {})
    await fs.unlink(testFile2).catch(() => {})

    const chainedCommand = `touch ${testFile1} && touch ${testFile2}`
    await capability.buildWithCommand(chainedCommand, temporaryFolder, { disableChildManager: true })

    const file1Exists = await fs
      .access(testFile1)
      .then(() => true)
      .catch(() => false)
    const file2Exists = await fs
      .access(testFile2)
      .then(() => true)
      .catch(() => false)

    ok(capability.stdout.messages[0].includes(getExecutedCommandLogMessage(chainedCommand)))
    ok(file1Exists, 'First command in chain did not execute')
    ok(file2Exists, 'Second command in chain did not execute')

    await fs.unlink(testFile1).catch(() => {})
    await fs.unlink(testFile2).catch(() => {})

    const semicolonCommand = `touch ${testFile1}; touch ${testFile2}`
    await capability.buildWithCommand(semicolonCommand, temporaryFolder, { disableChildManager: true })

    const file1ExistsAgain = await fs
      .access(testFile1)
      .then(() => true)
      .catch(() => false)
    const file2ExistsAgain = await fs
      .access(testFile2)
      .then(() => true)
      .catch(() => false)

    ok(capability.stdout.messages.some(msg => msg.includes(getExecutedCommandLogMessage(semicolonCommand))))
    ok(file1ExistsAgain, 'First command with semicolon did not execute')
    ok(file2ExistsAgain, 'Second command with semicolon did not execute')
  } finally {
    await fs.unlink(testFile1).catch(() => {})
    await fs.unlink(testFile2).catch(() => {})
  }
})
