import { safeRemove } from '@platformatic/foundation'
import { updateConfigFile } from '@platformatic/runtime/test/helpers.js'
import { connect } from 'inspector-client'
import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { request } from 'undici'
import { prepareRuntime } from '../../basic/test/helper.js'
import { changeWorkingDirectory, prepareGitRepository, waitForStart, wattpm } from './helper.js'

test('dev - should start in development mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
    plt_dev: true,
    plt_environment: 'development'
  })

  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('dev - should start in development mode starting from an application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await safeRemove(resolve(rootDir, 'watt.json'))

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
    plt_dev: true,
    plt_environment: 'development'
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
      `Cannot find a supported Watt configuration file (like watt.json, a wattpm.json or a platformatic.json) in ${nonExistentDirectory}.`
    )
  )
})

test('dev - should complain if no entrypoint is defined', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  await updateConfigFile(resolve(rootDir, 'watt.json'), config => {
    delete config.entrypoint
  })

  const devstartProcess = await wattpm('dev', rootDir, { reject: false })

  deepStrictEqual(devstartProcess.exitCode, 1)

  ok(
    devstartProcess.stdout.includes(
      'Cannot determine the application entrypoint. Please define it via the "entrypoint" key in your configuration file.'
    )
  )
})

test('dev - should restart an application if files are changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
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

  const configProcess = await wattpm('config', startProcess.pid)
  const config = JSON.parse(configProcess.stdout)
  ok(config.watch)
  deepStrictEqual(config.applications[1].id, 'main')
  ok(config.applications[0].watch)

  const indexFile = resolve(applicationDir, 'index.js')
  const originalContents = await readFile(indexFile, 'utf-8')

  await writeFile(indexFile, originalContents.replace('123', '456'), 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('The application "main" has been successfully reloaded')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (.+)/)
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
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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

  const configFile = resolve(rootDir, 'watt.json')
  const originalContents = await readFile(configFile, 'utf-8')

  const config = JSON.parse(originalContents)
  config.logger.level = 'trace'
  await writeFile(configFile, JSON.stringify(config), 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('This is a trace')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (.+)/)
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

test('dev - should restart an application if the application configuration file is changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
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

  const configFile = resolve(applicationDir, 'watt.json')
  const originalContents = await readFile(configFile, 'utf-8')

  const config = JSON.parse(originalContents)
  config.application = {}
  await writeFile(configFile, JSON.stringify(config), 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('The application "main" has been successfully reloaded')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (.+)/)
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

test('dev - should restart an application if "rs" is typed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('The application has been successfully reloaded')) {
      reloaded = true
      continue
    }

    const mo = parsed.msg?.match(/Platformatic is now listening at (.+)/)
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

test('start - should start in production mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
    plt_dev: false,
    plt_environment: 'production'
  })

  const configProcess = await wattpm('config', startProcess.pid)
  const config = JSON.parse(configProcess.stdout)

  ok(config.watch === false)
  deepStrictEqual(config.applications[1].id, 'main')
  ok(config.applications[0].watch === false)

  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('start - should start in production mode starting from an application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await safeRemove(resolve(rootDir, 'watt.json'))

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
    plt_dev: false,
    plt_environment: 'production'
  })

  const configProcess = await wattpm('config', startProcess.pid)
  const config = JSON.parse(configProcess.stdout)

  ok(config.watch === false)
  deepStrictEqual(config.applications[0].id, 'main')
  ok(config.applications[0].watch === false)

  ok(parsed.some(p => p.msg?.includes('Started the worker 0 of the application "main"')))
  ok(!parsed.some(p => p.msg?.includes('Started the worker 0 of the application "alternative"')))
})

test('start - should start in production mode with the inspector', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
    plt_dev: false,
    plt_environment: 'production'
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
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await prepareGitRepository(t, rootDir)

  const config = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  config.web = [{ id: 'resolved', path: '' }]
  await writeFile(resolve(rootDir, 'watt.json'), JSON.stringify(config, null, 2), 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const startProcess = await wattpm('start', rootDir, { reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(l => {
        return (
          JSON.parse(l).msg ===
          'The application "resolved" has no path defined. Please check your configuration and try again.'
        )
      }),
    startProcess.stdout
  )
})

test('start - should complain if no entrypoint is defined', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  await updateConfigFile(resolve(rootDir, 'watt.json'), config => {
    delete config.entrypoint
  })

  const devstartProcess = await wattpm('start', rootDir, { reject: false })

  deepStrictEqual(devstartProcess.exitCode, 1)

  ok(
    devstartProcess.stdout.includes(
      'Cannot determine the application entrypoint. Please define it via the "entrypoint" key in your configuration file.'
    )
  )
})

test('stop - should stop an application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
