import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
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
  const devstartProcess = await wattpm('dev', '/non/existent', { reject: false })

  deepStrictEqual(devstartProcess.exitCode, 1)
  ok(
    devstartProcess.stdout.includes(
      'Cannot find a watt.json, a wattpm.json or a platformatic.json file in /non/existent.'
    )
  )
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
