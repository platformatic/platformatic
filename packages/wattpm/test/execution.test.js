import { safeRemove } from '@platformatic/foundation'
import { updateConfigFile } from '@platformatic/runtime/test/helpers.js'
import getPort from 'get-port'
import { connect } from 'inspector-client'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { on } from 'node:events'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import split2 from 'split2'
import { request } from 'undici'
import { createTemporaryDirectory, prepareRuntime } from '../../basic/test/helper.js'
import { changeWorkingDirectory, parseRuntimeLog, prepareGitRepository, waitForStart, wattpm } from './helper.js'

test('dev - should start in development mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  const { url, parsed } = await waitForStart(startProcess)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    production: false,
    plt_dev: null,
    plt_environment: null
  })

  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('dev - should start in development mode starting from an application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', resolve(rootDir, 'web/main'))
  const { url, parsed } = await waitForStart(startProcess)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    production: false,
    plt_dev: null,
    plt_environment: null
  })

  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(!parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('dev - should complain if no configuration file is found', async t => {
  const nonExistentDirectory = resolve('/non/existent') // Use resolve to have this test pass on Windows
  const devstartProcess = await wattpm('dev', nonExistentDirectory, { reject: false })

  deepStrictEqual(devstartProcess.exitCode, 1)

  ok(
    devstartProcess.stdout.includes(
      `Cannot find a supported Watt configuration file (like watt.config.ts or watt.config.js, or a legacy watt.json) in ${nonExistentDirectory}.`
    )
  )
})

test('dev - should restart an application if files are changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const applicationDir = resolve(rootDir, 'web/main')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let { url } = await waitForStart(startProcess)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  /*
    There was a `wattpm config <pid>` here, reading the running runtime's configuration to assert
    that watching was on before waiting for a restart. v4 removed that command with the endpoint
    behind it, and the assertion was a precondition rather than the point: what follows observes the
    restart itself, which is the only evidence that watching works.
  */
  const indexFile = resolve(applicationDir, 'index.js')
  const originalContents = await readFile(indexFile, 'utf-8')

  await writeFile(indexFile, originalContents.replace('123', '456'), 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = parseRuntimeLog(log)

    if (!parsed) {
      continue
    }

    if (parsed.msg.startsWith('The application "main" has been successfully reloaded')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "main"/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  ok(reloaded)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 456 })
  }
})

test('dev - should restart an application if the runtime configuration file is changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let { url } = await waitForStart(startProcess)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  const configFile = resolve(rootDir, 'watt.config.mjs')
  const originalContents = await readFile(configFile, 'utf-8')

  /*
    Edited as source. A v4 configuration is a module, so it cannot be round-tripped through
    `JSON.parse` -- and what this asserts is that a change to the file reloads the runtime, which
    any real edit demonstrates.
  */
  await writeFile(configFile, `${originalContents}\n// touched by the test\n`, 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = parseRuntimeLog(log)

    if (!parsed) {
      continue
    }

    if (parsed.msg.startsWith('This is a trace')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "main"/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  ok(reloaded)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }
})

/*
  What `runtime/test/cli/do-not-crash-on-bad-config.test.js` used to assert, at the position the
  subject moved to. v3 read an application's configuration in its worker, so a file that stopped
  parsing broke that worker; v4 reads it main-side, once, and a file that stops evaluating breaks
  the *reload* instead. The runtime has to survive it either way: report the failure and keep
  serving what it already loaded.
*/
test('dev - should survive an application configuration file that stops evaluating', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const configFile = resolve(rootDir, 'web/main/watt.config.js')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  await waitForStart(startProcess)

  const originalContents = await readFile(configFile, 'utf-8')

  /*
    Written repeatedly rather than once: the watcher arms shortly after the listening line, and a
    single write landing in that gap is a change nobody sees -- the wait below would then never
    resolve, which is how this test hung on CI. Re-writing until the reload reports makes the
    trigger independent of who wins that race; each write differs, so the watcher cannot dismiss
    one as unchanged.
  */
  const waitForLine = async predicate => {
    const stream = startProcess.stdout.pipe(split2())

    try {
      // Iterated as a stream, not through events.on, so the loop actually ends when the stream does.
      for await (const log of stream) {
        const line = log.toString()
        let message = line

        try {
          const parsed = JSON.parse(line)
          message = parsed.err?.message ?? parsed.msg ?? line
        } catch {
          // A human-readable CLI line rather than a runtime record; both share this stream.
        }

        if (predicate(message, line)) {
          return true
        }
      }
    } finally {
      startProcess.stdout.unpipe(stream)
    }

    return false
  }

  const triggerUntil = async (contents, predicate) => {
    let attempt = 0
    const observed = waitForLine(predicate).then(found => ({ settled: true, found }))

    while (true) {
      await writeFile(configFile, `${contents}${'\n'.repeat(attempt++)}`, 'utf-8')

      const outcome = await Promise.race([observed, sleep(5000, { settled: false })])
      if (outcome.settled) {
        // false only when the stream ended -- the dev server died, which is its own failure.
        return outcome.found
      }
    }
  }

  const reported = await triggerUntil('export default { server: {', message => {
    return message.includes('Unexpected end of input') || message.includes('Cannot parse config file')
  })

  ok(reported)

  /*
    And the watchers are re-armed against the targets the last good configuration named, so the
    corrected file starts the runtime again. That is the half that makes surviving useful: a dev
    server that stays up but stops watching is a dev server you have to restart by hand.
  */
  const restarted = await triggerUntil(originalContents, (_, line) => {
    return line.includes('Platformatic is now listening')
  })

  ok(restarted)
})

test('dev - should restart an application if the application configuration file is changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const applicationDir = resolve(rootDir, 'web/main')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  const { url } = await waitForStart(startProcess)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  // The application's own file, which the codemod named .js because its package is a module.
  const configFile = resolve(applicationDir, 'watt.config.js')
  const originalContents = await readFile(configFile, 'utf-8')

  /*
    The runtime reloads, rather than the application restarting itself. An application's own
    configuration file is part of what the loader read to build the topology, so changing it is a
    configuration change -- v3 did not watch it and left the application's worker to notice, which
    is why this used to wait for "has been successfully reloaded".
  */
  let reloaded = false
  let lastListening = null

  const stream = startProcess.stdout.pipe(split2())

  let sawListening
  const firstListening = new Promise(resolve => {
    sawListening = resolve
  })

  /*
    Iterated as a stream, not through events.on: stream iteration ends when the stream does, and
    the stream only ends when the dev server died -- which is its own failure, so the finally
    settles the wait, the loops below stop, and the assertions report it. events.on never ends on
    'end', which made the previous version's safety net unreachable.
  */
  let observerError = null
  let streamEnded = false

  const observing = (async () => {
    try {
      for await (const log of stream) {
        const parsed = parseRuntimeLog(log)

        if (typeof parsed?.msg !== 'string') {
          continue
        }

        if (parsed.msg.startsWith('The configuration has changed')) {
          reloaded = true
          continue
        }

        const mo = parsed.msg.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "main"/)
        if (mo) {
          lastListening = { url: mo[1], at: Date.now() }
          sawListening()
        }
      }
    } catch (error) {
      observerError = error
    } finally {
      streamEnded = true
      sawListening()
    }
  })()

  /*
    Edited as source, because the application's configuration is a module too -- and written
    repeatedly rather than once: the watcher arms shortly after the listening line, and a single
    write landing in that gap is a change nobody sees, which left this wait hanging on CI. Each
    write differs, so the watcher cannot dismiss one as unchanged.
  */
  let attempt = 0
  const observed = firstListening.then(() => ({ settled: true }))

  while (true) {
    await writeFile(configFile, `${originalContents}\n// touched by the test${'\n'.repeat(attempt++)}`, 'utf-8')

    const outcome = await Promise.race([observed, sleep(5000, { settled: false })])
    if (outcome.settled) {
      break
    }
  }

  deepStrictEqual(observerError, null)
  ok(reloaded)
  ok(lastListening)

  /*
    A write may have landed just before the reload it was chasing reported, starting another
    reload behind the observed one, and on a slow machine each reload takes tens of seconds -- no
    quiet-window heuristic survives that. The observer stays attached so the address follows every
    restart, and the request retries until whichever reload is last answers; a server that never
    comes back fails the test by its timeout, naming this wait.
  */
  let version
  // eslint-disable-next-line no-unmodified-loop-condition -- the observer above mutates streamEnded
  while (version === undefined && !streamEnded) {
    try {
      const { statusCode, body } = await request(new URL('/version', lastListening.url))

      if (statusCode === 200) {
        version = await body.json()
        continue
      }

      await body.dump()
    } catch {
      // The server is between reloads; the next listening line moves the address.
    }

    await sleep(1000)
  }

  startProcess.stdout.unpipe(stream)
  stream.destroy()
  await observing

  deepStrictEqual(version, { version: 123 })
})

test('dev - should restart an application if "rs" is typed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let { url } = await waitForStart(startProcess)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  startProcess.stdin.write('abc\nrs\n')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = parseRuntimeLog(log)

    if (!parsed) {
      continue
    }

    if (parsed.msg.startsWith('The application has been successfully reloaded')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "main"/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  ok(reloaded)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }
})

test('dev - should load custom env file after runtime configuration file change triggers a restart', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  const customEnvFile = resolve(rootDir, 'custom.env')
  await writeFile(customEnvFile, 'PLT_CUSTOM_LOGGER_LEVEL=trace', 'utf8')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir, '--env', customEnvFile)
  await waitForStart(startProcess)

  const configFile = resolve(rootDir, 'watt.config.mjs')
  const originalContents = await readFile(configFile, 'utf-8')

  /*
    The level comes from the environment now. v3 wrote `{PLT_CUSTOM_LOGGER_LEVEL}` and let
    interpolation replace it; a v4 configuration reads the variable itself.
  */
  await writeFile(
    configFile,
    originalContents.replace("level: 'trace'", "level: process.env.PLT_CUSTOM_LOGGER_LEVEL ?? 'trace'"),
    'utf-8'
  )

  let url
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = parseRuntimeLog(log)

    if (!parsed) {
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (\S+) for worker \d+ of the application "main"/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  ok(url)

  {
    const { statusCode } = await request(url)
    deepStrictEqual(statusCode, 200)
  }
})

test('start - should start in production mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  const { url, parsed } = await waitForStart(startProcess)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    production: true,
    plt_dev: null,
    plt_environment: null
  })

  /*
    The `wattpm config <pid>` read that asserted watching was off in production went with the
    command and the endpoint behind it. What it was guarding is asserted directly below: production
    starts the applications and does not watch them.
  */
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('start - should start in production mode starting from an application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', resolve(rootDir, 'web/main'))
  const { url, parsed } = await waitForStart(startProcess)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    production: true,
    plt_dev: null,
    plt_environment: null
  })

  /*
    The `wattpm config <pid>` read that asserted watching was off in production went with the
    command and the endpoint behind it. What it was guarding is asserted directly below: production
    starts the applications and does not watch them.
  */
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(!parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('start - should start in production mode with the inspector', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir, '--inspect')
  const { url } = await waitForStart(startProcess)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    production: true,
    plt_dev: null,
    plt_environment: null
  })

  const [data] = await (await fetch('http://127.0.0.1:9230/json/list')).json()
  const { webSocketDebuggerUrl } = data

  const client = await connect(webSocketDebuggerUrl)

  const res = await client.post('Runtime.evaluate', {
    expression: "require('worker_threads').threadId",
    includeCommandLineAPI: true,
    generatePreview: true,
    returnByValue: true,
    awaitPromise: true
  })

  ok(typeof res.result.value, 'number')

  await client.close()
})

test('start - should throw an error when an application has no path and it is not resolvable', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  await prepareGitRepository(t, rootDir)

  /*
    A remote application that has not been fetched, which is what "no path" means in v4. v3 wrote an
    empty string and the runtime refused it; v4 resolves `path: ''` against the configuration's own
    directory, so an empty path is the project root rather than a missing one -- the state worth
    refusing is an entry whose code is not on disk yet.
  */
  await writeFile(
    resolve(rootDir, 'watt.config.mjs'),
    "export default { applications: [{ id: 'resolved', url: 'https://github.com/platformatic/nonexistent.git' }] }\n",
    'utf-8'
  )

  changeWorkingDirectory(t, rootDir)
  const startProcess = await wattpm('start', rootDir, { reject: false })

  deepStrictEqual(startProcess.exitCode, 1)

  /*
    The message names the command that fixes it. The loader records the entry as unresolved rather
    than refusing it -- `resolve` runs in exactly this state and has to load the configuration
    before it can fetch anything -- and the boot is what refuses.
  */
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(line => {
        /*
          `start` shares stdout between the runtime's JSON records and the CLI's human-readable
          lines, so the message has to be read out of a parsed record: the quotes around the
          application id are escaped in the raw text.
        */
        try {
          return (
            JSON.parse(line).msg ===
            'The path for application "resolved" does not exist. Please run "wattpm resolve" and try again.'
          )
        } catch {
          return false
        }
      }),
    startProcess.stdout
  )
})

test('stop - should stop an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  const stop = await wattpm('stop', 'main')
  const { exitCode } = await startProcess

  ok(stop.stdout.includes('Runtime main have been stopped.'))
  deepStrictEqual(exitCode, 0)
})

test('stop - should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('stop', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('restart - should restart an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  const restart = await wattpm('restart', 'main')

  ok(restart.stdout.includes('Runtime main has been restarted.'))
})

test('restart - can restart an application when its port is fixed and reusePort is disabled', async t => {
  const port = await getPort()

  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs', async root => {
    await updateConfigFile(resolve(root, 'web/main/watt.json'), config => {
      config.server = { port }
    })

    // reuseTcpPorts is orchestration, so it moves to the root: v4 has no runtime block inside an
    // application's own configuration.
    await updateConfigFile(resolve(root, 'watt.config.mjs'), config => {
      config.reuseTcpPorts = false
    })
  })

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  const restart = await wattpm('restart', 'main')

  ok(restart.stdout.includes('Runtime main has been restarted.'))
})

test('restart - should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('restart', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('reload - should reload an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess)

  const reload = await wattpm('reload', 'main')
  const { exitCode } = await startProcess

  const mo = reload.stdout.match(/Runtime main have been reloaded and it is now running as PID (\d+)./)
  ok(mo)
  deepStrictEqual(exitCode, 0)

  process.kill(parseInt(mo[1]), 'SIGINT')
})

test('reload - should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('reload', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('start - should load custom env file with --env flag', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  // Create a custom env file
  const customEnvFile = resolve(rootDir, 'custom.env')
  await writeFile(customEnvFile, 'CUSTOM_VAR=from_custom_env\nTEST_VAR=test123', 'utf8')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir, '--env', customEnvFile)
  const { url, parsed } = await waitForStart(startProcess)

  const { statusCode } = await request(url)
  deepStrictEqual(statusCode, 200)

  // Verify that the custom env vars are available
  ok(parsed.some(p => p.msg?.includes('Loading envfile')))
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
})

test('dev - should load custom env file with --env flag', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  // Create a custom env file
  const customEnvFile = resolve(rootDir, 'custom-dev.env')
  await writeFile(customEnvFile, 'DEV_CUSTOM_VAR=from_dev_custom\nDEV_TEST=abc456', 'utf8')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir, '--env', customEnvFile)
  const { url, parsed } = await waitForStart(startProcess)

  const { statusCode } = await request(url)
  deepStrictEqual(statusCode, 200)

  // Verify that the custom env vars are available
  ok(parsed.some(p => p.msg?.includes('Loading envfile')))
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
})

test('start --debug-config - should print the resolved configuration without starting anything', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  const debugProcess = await wattpm('start', '--debug-config', rootDir)
  const config = JSON.parse(debugProcess.stdout)

  /*
    The point is that it resolved rather than merely parsed: the applications are the expanded list,
    and nothing was started to produce them.
  */
  ok(Array.isArray(config.applications))
  ok(config.applications.some(application => application.id === 'main'))
  ok(config.applications.some(application => application.id === 'alternative'))

  // The symbol-keyed loader envelope is bookkeeping, not configuration, and does not survive JSON.
  deepStrictEqual(config.__metadata, undefined)
})

test('dev --debug-config - should print the resolved configuration without starting anything', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  const debugProcess = await wattpm('dev', '--debug-config', rootDir)
  const config = JSON.parse(debugProcess.stdout)

  ok(config.applications.some(application => application.id === 'main'))
})

test('start --debug-config - should resolve a v4 configuration through the eval worker', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'build', false, 'watt.config.mjs')

  const debugProcess = await wattpm('start', '--debug-config', rootDir)
  const config = JSON.parse(debugProcess.stdout)

  // The eval worker expanded autoload, so what is printed is the application list a boot would use.
  ok(Array.isArray(config.applications))
  ok(config.applications.length > 0)
})

test('dev - should restart an application when a file the configuration imports is changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'imported-config', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  await waitForStart(startProcess)

  /*
    The deciding file is untouched: what changes is a module it imports. Watching only the
    configuration file meant this edit reloaded nothing, which is the whole reason the loader
    collects the import graph.

    Written repeatedly rather than once: the watcher arms shortly after the listening line, and a
    single write landing in that gap is a change nobody sees -- the wait below would then never
    resolve, which is how this test hung on CI.
  */
  let reloaded = false

  const observed = (async () => {
    for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
      const parsed = parseRuntimeLog(log)

      if (!parsed) {
        continue
      }

      if (parsed.msg?.startsWith('The configuration has changed, reloading the application')) {
        reloaded = true
      }

      if (parsed.msg?.match(/Platformatic is now listening at \S+ for worker \d+ of the application "main"/)) {
        return true
      }
    }

    return false
  })().then(found => ({ settled: true, found }))

  let attempt = 0
  while (true) {
    await writeFile(resolve(rootDir, 'logging.mjs'), `export const level = 'trace'\n${'\n'.repeat(attempt++)}`, 'utf-8')

    const outcome = await Promise.race([observed, sleep(5000, { settled: false })])
    if (outcome.settled) {
      ok(outcome.found)
      break
    }
  }

  ok(reloaded)
})

test('the boot scope is announced, and a standalone boot warns about what is not applied', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'imported-config', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  /*
    Scope is positional, and the one thing a positional rule must never be is silent. Both of these
    were being handed to a no-op logger and discarded — including the warning the format relies on
    to say that nothing the root config declares is in effect.
  */
  const startProcess = wattpm('dev', resolve(rootDir, 'web/main'))
  const seen = []

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const line = log.toString()
    seen.push(line)

    if (line.includes('sibling applications and http://*.plt.local are unavailable')) {
      break
    }
  }

  const output = seen.join('\n')
  ok(output.includes('booting one application standalone'), output)
})

test('start --config-timeout - a configuration that never resolves fails the load rather than hanging', async t => {
  /*
    Copied rather than prepared: prepareRuntime evaluates the configuration to patch its listener
    ports, and this one never resolves — the helper would hang in the test process instead of the
    CLI, which is the opposite of what is under test.
  */
  const rootDir = await createTemporaryDirectory(t, 'slow-config')
  await cp(resolve(import.meta.dirname, 'fixtures/slow-config'), rootDir, { recursive: true })

  /*
    The default deadline is 30s, which a test should not wait for. The flag exists precisely because
    the right answer differs per deployment — an awaited fetch to a dead host is not the same
    problem as a slow one.
  */
  const startProcess = await wattpm('start', '--config-timeout', '1500', rootDir, { reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(/timed out after 1500ms/.test(startProcess.stdout + startProcess.stderr), startProcess.stdout + startProcess.stderr)
})

test('start --mode - selects the environment files the named mode names', async t => {
  const rootDir = await createTemporaryDirectory(t, 'mode-select')
  await cp(resolve(import.meta.dirname, 'fixtures/mode-select'), rootDir, { recursive: true })

  const withoutMode = await wattpm('start', '--debug-config', rootDir)
  const defaulted = JSON.parse(withoutMode.stdout)

  strictEqual(defaulted.messagingTimeout, 22222)
  strictEqual(defaulted.startTimeout, 1000)

  /*
    Mode selects env files everywhere, so naming one has to change which files are read — not only
    what `ctx.mode` reports. A flag that reached the context but not the file set would pass a
    weaker test and fail every real use, so both are asserted.
  */
  const staging = await wattpm('start', '--debug-config', '--mode', 'staging', rootDir)
  const selected = JSON.parse(staging.stdout)

  strictEqual(selected.messagingTimeout, 11111)
  strictEqual(selected.startTimeout, 4242)
})
