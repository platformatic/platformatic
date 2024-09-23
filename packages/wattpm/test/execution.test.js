import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { request } from 'undici'
import { ensureDependency, fixturesDir, waitForStart, wattpm } from './helper.js'

test('dev - should start in development mode', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  const url = await waitForStart(startProcess.stdout)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), { production: false })
})

test('dev - should complain if no configuration file is found', async t => {
  const nonExistentDirectory = resolve('/non/existent') // Use resolve to have this test pass on Windows
  const devstartProcess = await wattpm('dev', nonExistentDirectory, { reject: false })

  deepStrictEqual(devstartProcess.exitCode, 1)
  ok(
    devstartProcess.stdout.includes(
      `Cannot find a watt.json, a wattpm.json or a platformatic.json file in ${nonExistentDirectory}.`
    )
  )
})

test('dev - should restart an application if files are changed', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let url = await waitForStart(startProcess.stdout)

  {
    const { statusCode, body } = await request(new URL('/version', url))
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { version: 123 })
  }

  const configProcess = await wattpm('config', startProcess.pid)
  const config = JSON.parse(configProcess.stdout)
  ok(config.watch)
  deepStrictEqual(config.services[0].id, 'main')
  ok(config.services[0].watch)

  const indexFile = resolve(serviceDir, 'index.js')
  const originalContents = await readFile(indexFile, 'utf-8')

  await writeFile(indexFile, originalContents.replace('123', '456'), 'utf-8')

  // Restore original file after the test
  t.after(() => writeFile(indexFile, originalContents, 'utf-8'))

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Service main has been successfully reloaded')) {
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
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let url = await waitForStart(startProcess.stdout)

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

  // Restore original file after the test
  t.after(() => writeFile(configFile, originalContents, 'utf-8'))

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
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('dev', rootDir)
  let url = await waitForStart(startProcess.stdout)

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

  // Restore original file after the test
  t.after(() => writeFile(configFile, originalContents, 'utf-8'))

  // Wait for the server to restart
  let reloaded = false
  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Service main has been successfully reloaded')) {
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
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  const url = await waitForStart(startProcess.stdout)

  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)
  deepStrictEqual(await body.json(), { production: true })

  const configProcess = await wattpm('config', startProcess.pid)
  const config = JSON.parse(configProcess.stdout)

  ok(config.watch === false)
  deepStrictEqual(config.services[0].id, 'main')
  ok(config.services[0].watch === false)
})

test('stop - should stop an application', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

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
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  t.after(() => {
    startProcess.kill('SIGINT')
    return startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  const restart = await wattpm('restart', 'main')

  ok(restart.stdout.includes('Runtime main have been restarted.'))
})

test('restart - should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('restart', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})

test('reload - should reload an application', async t => {
  const rootDir = await resolve(fixturesDir, 'main')
  const serviceDir = await resolve(rootDir, 'web/main')
  await ensureDependency(t, serviceDir, '@platformatic/node')
  await ensureDependency(t, serviceDir, 'fastify')

  const startProcess = wattpm('start', rootDir)
  await waitForStart(startProcess.stdout)

  const reload = await wattpm('reload', 'main')
  const { exitCode } = await startProcess

  const mo = reload.stdout.match(/Runtime main have been reloaded and it is now running as PID (\d+)./)
  ok(mo)
  deepStrictEqual(exitCode, 0)

  process.kill(parseInt(mo[1]), 'SIGINT')
})

test('reload -should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('reload', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})
