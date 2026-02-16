import {execa} from 'execa'
import {fastify} from 'fastify'
import {deepStrictEqual, ok} from 'node:assert'
import {join, resolve} from 'node:path'
import {afterEach, test} from 'node:test'
import {Agent, getGlobalDispatcher, request, setGlobalDispatcher} from 'undici'
import {transform} from '../index.js'
import {startPath} from './cli/helper.js'
import {createRuntime, isWindows, updateFile} from './helpers.js'
import {prepareRuntime} from './multiple-workers/helper.js'

function stdioOutputToLogs (data) {
  const logs = data
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return line
          .trim()
          .split('\n')
          .map(l => {
            try {
              return JSON.parse(l)
            } catch {}
            return null
          })
          .filter(log => log)
      }
    })
    .filter(log => log)

  const lines = logs.flat()
  return lines
}

async function requestAndDump (url, opts) {
  try {
    const { body } = await request(url, opts)
    await body.text()
  } catch {}
}

function execRuntime ({ configPath, onReady, done, timeout = 30_000, debug = false }) {
  return new Promise((resolve, reject) => {
    if (!done) {
      reject(new Error('done fn is required'))
    }

    const result = {
      stdout: [],
      stderr: [],
      url: null
    }
    let ready = false
    let teardownCalled = false

    async function teardown () {
      if (teardownCalled) {
        return
      }
      teardownCalled = true

      timeoutId && clearTimeout(timeoutId)

      if (!child) {
        return
      }
      child.kill('SIGKILL')
      child.catch(() => {})
      child = null
    }

    let child = execa(process.execPath, [startPath, configPath], {
      encoding: 'utf8',
      env: { PLT_USE_PLAIN_CREATE: true }
    })

    const timeoutId = setTimeout(async () => {
      clearTimeout(timeoutId)

      await teardown()
      reject(new Error('Timeout'))
    }, timeout)

    child.stdout.on('data', message => {
      const m = message.toString()
      result.stdout.push(m)

      if (done(m)) {
        teardown().then(() => {
          resolve(result)
        })
        return
      }

      if (ready) {
        return
      }

      const match = m.match(/Platformatic is now listening at (http:\/\/127\.0\.0\.1:\d+)/)
      if (match) {
        result.url = match[1]
        try {
          onReady?.({ url: result.url })
        } catch (err) {
          teardown().then(() => {
            reject(new Error('Error calling onReady', { cause: err }))
          })
        }
        ready = true
      }
    })

    child.stderr.on('data', message => {
      const msg = message.toString()
      result.stderr.push(msg)
    })
  })
}

setGlobalDispatcher(new Agent({ keepAliveTimeout: 10, keepAliveMaxTimeout: 10 }))

afterEach(async () => {
  await getGlobalDispatcher().close()
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 10, keepAliveMaxTimeout: 10 }))
})

test('should use full logger options - formatters, timestamp, redaction', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-options', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/logs' })
      requested = true
    },
    done: message => {
      return requested
    }
  })
  const logs = stdioOutputToLogs(stdout)

  ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'service' &&
        log.msg === 'Starting the worker 0 of the application "app"...'
    )
  )
  ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'service' &&
        log.msg === 'Started the worker 0 of the application "app"...'
    )
  )
  ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'service' &&
        log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')
    )
  )
})

test('should inherit full logger options from runtime to a platformatic/application', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-options', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/logs' })
      requested = true
    },
    done: message => {
      return requested && message.includes('call route /logs')
    }
  })
  const logs = stdioOutputToLogs(stdout)

  ok(
    logs.find(
      log =>
        log.stdout.level === 'DEBUG' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.name === 'service' &&
        log.stdout.msg === 'Loading envfile...'
    )
  )

  ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'service' &&
        log.msg === 'Starting the worker 0 of the application "app"...'
    )
  )

  ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'service' &&
        log.msg === 'Started the worker 0 of the application "app"...'
    )
  )

  ok(
    logs.find(
      log =>
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'service' &&
        log.msg.startsWith('Platformatic is now listening at http://127.0.0.1:')
    )
  )

  ok(
    logs.find(log => {
      if (
        log.level === 'INFO' &&
        log.time.length === 24 && // isotime
        log.name === 'app'
      ) {
        return (
          log.stdout.level === 'DEBUG' &&
          log.stdout.time.length === 24 && // isotime
          log.stdout.name === 'service' &&
          log.stdout.secret === '***HIDDEN***' &&
          log.stdout.msg === 'call route /logs'
        )
      }
      return false
    })
  )
})

test('should inherit full logger options from runtime to different applications', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-options-all', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/logs' })
      requested = true
    },
    done: message => {
      return requested
    }
  })
  const logs = stdioOutputToLogs(stdout)

  for (const t of ['composer', 'service', 'node']) {
    ok(
      logs.find(
        log =>
          log.level === 'INFO' &&
          log.time.length === 24 && // isotime
          log.name === 'service' &&
          log.msg === `Started the worker 0 of the application "${t}"...`
      )
    )
  }
})

test('should get json logs from thread applications when they are not pino default config', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-options-all', 'platformatic.json')

  let requested = false
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/' })
      requested = true
    },
    done: message => {
      return requested
    }
  })
  const logs = stdioOutputToLogs(stdout).filter(log => log.caller === 'STDOUT')

  ok(
    logs.find(log => {
      return (
        log.stdout.level === 'INFO' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.name === 'service' &&
        log.stdout.msg === 'incoming request'
      )
    })
  )

  ok(
    logs.find(log => {
      return (
        log.stdout.level === 'INFO' &&
        log.stdout.time.length === 24 && // isotime
        log.stdout.name === 'service' &&
        log.stdout.msg === 'request completed'
      )
    })
  )
})

test(
  'should handle logs from thread applications as they are with captureStdio: false',
  { skip: isWindows },
  async t => {
    const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-no-capture', 'platformatic.json')

    let responses = 0
    let requested = false
    const { stdout } = await execRuntime({
      configPath,
      onReady: async ({ url }) => {
        await requestAndDump(url, { path: '/service/' })
        await requestAndDump(url, { path: '/node/' })
        requested = true
      },
      done: message => {
        if (message.includes('call route / on service')) {
          responses++
        } else if (message.includes('call route / on node')) {
          responses++
        }
        return requested && responses > 1
      }
    })
    const logs = stdioOutputToLogs(stdout)

    ok(
      logs.find(log => {
        return log.nodeLevel === 'debug' && log.name === 'node' && log.msg === 'call route / on node'
      })
    )

    ok(
      logs.find(log => {
        return log.applicationLevel === 'debug' && log.name === 'service' && log.msg === 'call route / on service'
      })
    )

    ok(
      logs.find(log => {
        return log.customLevelName === 'info' && log.msg === 'Starting the worker 0 of the application "node"...'
      })
    )

    ok(
      logs.find(log => {
        return log.customLevelName === 'info' && log.msg === 'Starting the worker 0 of the application "service"...'
      })
    )

    ok(
      logs.find(log => {
        return log.customLevelName === 'info' && log.msg === 'Starting the worker 0 of the application "composer"...'
      })
    )
  }
)

test('should handle logs from thread applications as they are with captureStdio: false and managementApi: false', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-no-capture-no-mgmt-api', 'platformatic.json')

  let responses = 0
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/service/' })
      await requestAndDump(url, { path: '/node/' })
    },
    done: message => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  ok(
    logs.find(log => {
      return log.nodeLevel === 'debug' && log.name === 'node' && log.msg === 'call route / on node'
    })
  )

  ok(
    logs.find(log => {
      return log.applicationLevel === 'debug' && log.name === 'service' && log.msg === 'call route / on service'
    })
  )

  ok(
    logs.find(log => {
      return log.customLevelName === 'info' && log.msg === 'Starting the worker 0 of the application "node"...'
    })
  )

  ok(
    logs.find(log => {
      return log.customLevelName === 'info' && log.msg === 'Starting the worker 0 of the application "service"...'
    })
  )

  ok(
    logs.find(log => {
      return log.customLevelName === 'info' && log.msg === 'Starting the worker 0 of the application "composer"...'
    })
  )
})

test('should use base and messageKey options', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-options-base-message-key', 'platformatic.json')

  let responses = 0
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/service/' })
      await requestAndDump(url, { path: '/node/' })
    },
    done: message => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  ok(
    logs.every(log => {
      return (
        log.customBaseName === 'a' &&
        log.customBaseItem === 'b' &&
        (log.theMessage ? log.theMessage.length > 0 : true) &&
        (log.stdout ? log.stdout.theMessage.length > 0 : true)
      )
    })
  )
})

test('should use null base in options', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-options-null-base', 'platformatic.json')

  let responses = 0
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/service/' })
      await requestAndDump(url, { path: '/node/' })
    },
    done: message => {
      if (message.includes('call route / on service')) {
        responses++
      } else if (message.includes('call route / on node')) {
        responses++
      }
      return responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  ok(
    logs.every(log => {
      const keys = Object.keys(log)
      return !keys.includes('pid') && !keys.includes('hostname')
    })
  )
})

test('should use custom config', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-custom-config', 'platformatic.json')

  let responses = 0
  const { stdout } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/service/' })
      await requestAndDump(url, { path: '/node/' })
    },
    done: message => {
      if (message.includes('request completed')) {
        responses++
      }
      return responses > 1
    }
  })
  const logs = stdioOutputToLogs(stdout)

  ok(
    logs.every(log => {
      const keys = Object.keys(log)
      return (
        typeof log.severity === 'string' &&
        log.message.length > 0 &&
        !keys.includes('pid') &&
        !keys.includes('hostname')
      )
    })
  )
})

test('should use colors when printing applications logs', async t => {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')

  await updateFile(configFile, data => {
    const config = JSON.parse(data)
    config.logger.level = 'info'
    return JSON.stringify(config, null, 2)
  })

  const child = execa(process.execPath, [startPath, configFile], {
    env: { FORCE_TTY: 'true', FORCE_COLOR: 'true', PLT_USE_PLAIN_CREATE: true },
    cwd: root
  })
  child.catch(() => {})

  const promise = Promise.withResolvers()
  let stdout = ''
  child.stdout.on('data', chunk => {
    stdout += chunk.toString()

    if (stdout.includes('Platformatic is now listening')) {
      child.kill('SIGKILL')
      promise.resolve()
    }
  })

  await promise.promise

  ok(
    stdout.match(
      // eslint-disable-next-line no-control-regex, no-regex-spaces
      /\n\u001b\[38;5;\d+m\[\d{2}:\d{2}:\d{2}\.\d+\] \(\d+\) composer:0 \|\u001b\[0m\u001b\[32m  INFO\u001b\[39m: \u001b\[36mWaiting for dependencies to start.\u001b\[39m/
    )
  )
})

// Regression test for: TypeError: Cannot read properties of null (reading 'level')
// This happens when a worker outputs the literal string "null" to stdout.
// JSON.parse("null") returns null, and typeof null === 'object' (JS quirk),
// so the code enters the object branch and tries to access null.level
test('should handle literal null output from workers without crashing', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-null-output', 'platformatic.json')

  let requested = false
  const { stderr } = await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      await requestAndDump(url, { path: '/null-output' })
      requested = true
    },
    done: message => {
      return requested && message.includes('null')
    }
  })

  // The runtime should not crash - if we got here, the test passed
  ok(requested, 'Request was made successfully')

  // Verify no crash error in stderr
  const stderrText = stderr.join('')
  ok(!stderrText.includes('Cannot read properties of null'), 'No null property access error')
})

// Regression test for logger level inheritance from runtime to applications.
// Previously, the logger schema had `default: 'info'` which would override
// the runtime-level logger setting when merging configs.
test('should inherit logger level from runtime when service does not specify logger level', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-level-inheritance', 'platformatic.json')

  let requested = false
  let levelResponse = null

  await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      // Check what level the application's logger is using
      const levelRes = await request(url, { path: '/get-level' })
      levelResponse = await levelRes.body.json()
      requested = true
    },
    done: message => {
      return requested
    }
  })

  // The service should have inherited 'debug' level from runtime,
  // not the old default 'info' from schema
  ok(levelResponse, 'Level response received')
  ok(
    levelResponse.level === 'debug',
    `Expected logger level to be 'debug' (inherited from runtime), but got '${levelResponse.level}'`
  )
})

// Same test but for @platformatic/node applications
test('should inherit logger level from runtime when node app does not specify logger level', async t => {
  const configPath = join(import.meta.dirname, '..', 'fixtures', 'logger-level-inheritance-node', 'platformatic.json')

  let requested = false
  let levelResponse = null

  await execRuntime({
    configPath,
    onReady: async ({ url }) => {
      // Check what level the node application's logger is using
      const levelRes = await request(url, { path: '/get-level' })
      levelResponse = await levelRes.body.json()
      requested = true
    },
    done: message => {
      return requested
    }
  })

  // The node app should have inherited 'debug' level from runtime,
  // not the old default 'info' from schema
  ok(levelResponse, 'Level response received')
  ok(
    levelResponse.level === 'debug',
    `Expected logger level to be 'debug' (inherited from runtime), but got '${levelResponse.level}'`
  )
})

// Same test but for @platformatic/node applications
test('should export logs to OpenTelemetry', async t => {
  function findAttribute (log, name) {
    return log.resourceLogs[0].resource.attributes.find(attr => attr.key === name)
  }

  const configFile = join(import.meta.dirname, '..', 'fixtures', 'logger-opentelemetry', 'platformatic.json')
  const { promise, resolve } = Promise.withResolvers()

  // Create a sample OpenTelemetry collector that listens for logs on a specific port and stores them in memory for assertions
  const server = fastify()
  t.after(() => server.close())

  await server.post('/v1/logs', async request => {
    for (const resourceLog of request.body.resourceLogs) {
      for (const scopeLog of resourceLog.scopeLogs) {
        for (const logRecord of scopeLog.logRecords) {
          if (logRecord.body && logRecord.body.stringValue === 'Serving request') {
            resolve(request.body)
          }
        }
      }
    }

    return {}
  })
  await server.listen({ port: 0 })

  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      const url = new URL(config.logger.telemetryExporter.url)
      url.port = server.server.address().port
      config.logger.telemetryExporter.url = url.toString()

      return config
    }
  })
  t.after(() => app.close())

  const entryUrl = await app.start()

  {
    const { statusCode, body } = await request(entryUrl, { path: '/' })
    deepStrictEqual(await statusCode, 200)
    deepStrictEqual(await body.text(), 'ok')
  }

  const log = await promise

  // Check that some attributes are present
  deepStrictEqual(findAttribute(log, 'service.name').value.stringValue, 'logger-opentelemetry')
  deepStrictEqual(findAttribute(log, 'service.version').value.stringValue, '1.0.0')
  deepStrictEqual(findAttribute(log, 'process.runtime.name').value.stringValue, 'nodejs')
  deepStrictEqual(findAttribute(log, 'process.runtime.description').value.stringValue, 'Node.js')

  // Check that OpenTelemetry trace and spans are present
  const scope = log.resourceLogs[0].scopeLogs[0].logRecords[0]
  deepStrictEqual(scope.body.stringValue, 'Serving request')
  ok(scope.traceId.match(/^[0-9a-f]+$/))
  ok(scope.spanId.match(/^[0-9a-f]+$/))
  deepStrictEqual(scope.flags, '01')
})
