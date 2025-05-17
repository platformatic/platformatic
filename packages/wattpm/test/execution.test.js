import { connect } from 'inspector-client'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { on } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { request } from 'undici'
import { ensureDependencies, prepareRuntime, updateFile } from '../../basic/test/helper.js'
import { prepareGitRepository, waitForStart, wattpm } from './helper.js'

test('dev - should start in development mode', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  const url = await waitForStart(startProcess)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), {
    production: false,
    plt_dev: true,
    plt_environment: 'development'
  })
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

test('dev - should restart an application if files are changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(rootDir, 'web/main')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let url = await waitForStart(startProcess)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  const configProcess = await wattpm('config', startProcess.pid)
  const config = JSON.parse(configProcess.stdout)
  ok(config.watch)
  deepStrictEqual(config.services[1].id, 'main')
  ok(config.services[0].watch)

  const indexFile = resolve(serviceDir, 'index.js')
  const originalContents = await readFile(indexFile, 'utf-8')

  await writeFile(indexFile, originalContents.replace('123', '456'), 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Service "main" has been successfully reloaded')) {
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
  let url = await waitForStart(startProcess)

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

test('dev - should restart an application if the service configuration file is changed', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const serviceDir = resolve(rootDir, 'web/main')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let url = await waitForStart(startProcess)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  const configFile = resolve(serviceDir, 'watt.json')
  const originalContents = await readFile(configFile, 'utf-8')

  const config = JSON.parse(originalContents)
  config.application = {}
  await writeFile(configFile, JSON.stringify(config), 'utf-8')

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Service "main" has been successfully reloaded')) {
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
  const url = await waitForStart(startProcess)

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
  deepStrictEqual(config.services[1].id, 'main')
  ok(config.services[0].watch === false)
})

test('start - should start in production mode with the inspector', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir, '--inspect')
  const url = await waitForStart(startProcess)

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

  strictEqual(res.result.value, 2)

  await client.close()
})

test('start - should use default folders for resolved services', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await prepareGitRepository(t, rootDir)

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  process.chdir(rootDir)
  await wattpm('import', rootDir, '-H', '-i', 'resolved', '{PLT_GIT_REPO_URL}')
  await wattpm('resolve', rootDir)
  await updateFile(resolve(rootDir, 'external/resolved/package.json'), content => {
    const config = JSON.parse(content)
    config.dependencies = { '@platformatic/node': '^2.8.0' }
    return JSON.stringify(config, null, 2)
  })

  await ensureDependencies([resolve(rootDir, 'external/resolved')])

  const startProcess = wattpm('start', rootDir)

  let started = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Started the service "resolved"')) {
      started = true
      break
    }
  }

  await waitForStart(startProcess)
  ok(started)
})

test('start - should throw an error when a service has not been resolved', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await prepareGitRepository(t, rootDir)

  process.chdir(rootDir)
  await wattpm('import', rootDir, '-H', '-i', 'resolved', '{PLT_GIT_REPO_URL}')

  const startProcess = await wattpm('start', rootDir, { reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(l => {
        return (
          JSON.parse(l).msg ===
          'The path for service "resolved" does not exist. Please run "watt resolve" and try again.'
        )
      }),
    startProcess.stdout
  )
})

test('start - should throw an error when a service has no path and it is not resolvable', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  await prepareGitRepository(t, rootDir)

  const config = JSON.parse(await readFile(resolve(rootDir, 'watt.json'), 'utf-8'))
  config.web = [{ id: 'resolved', path: '' }]
  await writeFile(resolve(rootDir, 'watt.json'), JSON.stringify(config, null, 2), 'utf-8')

  process.chdir(rootDir)
  const startProcess = await wattpm('start', rootDir, { reject: false })

  deepStrictEqual(startProcess.exitCode, 1)
  ok(
    startProcess.stdout
      .trim()
      .split('\n')
      .find(l => {
        return (
          JSON.parse(l).msg ===
          'The service "resolved" has no path defined. Please check your configuration and try again.'
        )
      }),
    startProcess.stdout
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
