import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { resolve } from 'node:path'
import { describe, test } from 'node:test'
import split2 from 'split2'
import { request } from 'undici'
import { ensureDependency, fixturesDir, wattpm } from './helper.js'

async function waitForStart (stream) {
  let url

  for await (const log of on(stream.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    const mo = parsed.msg.match(/Platformatic is now listening at (.+)/)
    if (mo) {
      url = mo[1]
      break
    }
  }

  return url
}

describe('dev', async t => {
  test('should start in development mode', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      subprocess.kill('SIGINT')
      return subprocess.catch(() => {})
    })

    const subprocess = wattpm('dev', rootDir)
    const url = await waitForStart(subprocess.stdout)

    const { statusCode, body } = await request(url)
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { production: false })
  })
})

describe('start', async t => {
  test('should start in production mode', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      subprocess.kill('SIGINT')
      return subprocess.catch(() => {})
    })

    const subprocess = wattpm('start', rootDir)
    const url = await waitForStart(subprocess.stdout)

    const { statusCode, body } = await request(url)
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(await body.json(), { production: true })
  })
})

describe('stop', async t => {
  test('should stop an application', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      return subprocess.catch(() => {})
    })

    const subprocess = wattpm('start', rootDir)
    await waitForStart(subprocess.stdout)

    const stop = await wattpm('stop', 'main')
    const { exitCode } = await subprocess

    ok(stop.stdout.includes('Runtime main have been stopped.'))
    deepStrictEqual(exitCode, 0)
  })

  test('should complain when a runtime is not found', async t => {
    const logsProcess = await wattpm('stop', 'p-' + Date.now.toString(), { reject: false })

    deepStrictEqual(logsProcess.exitCode, 1)
    ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
  })
})

describe('restart', async t => {
  test('should restart an application', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      subprocess.kill('SIGINT')
      return subprocess.catch(() => {})
    })

    const subprocess = wattpm('start', rootDir)
    await waitForStart(subprocess.stdout)

    const restart = await wattpm('restart', 'main')

    ok(restart.stdout.includes('Runtime main have been restarted.'))
  })

  test('should complain when a runtime is not found', async t => {
    const logsProcess = await wattpm('restart', 'p-' + Date.now.toString(), { reject: false })

    deepStrictEqual(logsProcess.exitCode, 1)
    ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
  })
})

describe('reload', async t => {
  test('should reload an application', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    const subprocess = wattpm('start', rootDir)
    await waitForStart(subprocess.stdout)

    const reload = await wattpm('reload', 'main')
    const { exitCode } = await subprocess

    const mo = reload.stdout.match(/Runtime main have been reloaded and it is now running as PID (\d+)./)
    ok(mo)
    deepStrictEqual(exitCode, 0)

    process.kill(parseInt(mo[1]), 'SIGINT')
  })

  test('should complain when a runtime is not found', async t => {
    const logsProcess = await wattpm('reload', 'p-' + Date.now.toString(), { reject: false })

    deepStrictEqual(logsProcess.exitCode, 1)
    ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
  })
})
