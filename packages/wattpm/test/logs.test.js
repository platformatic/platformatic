import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { resolve } from 'node:path'
import { describe, test } from 'node:test'
import split2 from 'split2'
import { ensureDependency, fixturesDir, wattpm } from './helper.js'

async function matchLogs (stream) {
  let mainLogFound
  let serviceLogFound
  let traceFound

  for await (const log of on(stream.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      mainLogFound = true
      continue
    }

    if (parsed.msg === 'This is a trace') {
      traceFound = true
      continue
    }

    if (parsed.msg.startsWith('Service listening') && parsed.name === 'main') {
      serviceLogFound = true
      break
    }
  }

  return { mainLogFound, serviceLogFound, traceFound }
}

describe('logs', async t => {
  test('should stream runtime logs', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      logsProcess.kill('SIGINT')
      startProcess.kill('SIGINT')

      Promise.all([startProcess.catch(() => {}), logsProcess.catch(() => {})])
    })

    const startProcess = wattpm('start', rootDir)

    for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
      const parsed = JSON.parse(log.toString())

      if (parsed.msg.startsWith('Platformatic is now listening')) {
        break
      }
    }

    const logsProcess = wattpm('logs', 'main')
    const { mainLogFound, serviceLogFound, traceFound } = await matchLogs(logsProcess.stdout)

    ok(serviceLogFound)
    ok(mainLogFound)
    ok(!traceFound)
  })

  test('should stream runtime logs filtering by service', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      logsProcess.kill('SIGINT')
      startProcess.kill('SIGINT')

      Promise.all([startProcess.catch(() => {}), logsProcess.catch(() => {})])
    })

    const startProcess = wattpm('start', rootDir)

    for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
      const parsed = JSON.parse(log.toString())

      if (parsed.msg.startsWith('Platformatic is now listening')) {
        break
      }
    }

    const logsProcess = wattpm('logs', 'main', 'main')
    const { mainLogFound, serviceLogFound, traceFound } = await matchLogs(logsProcess.stdout)

    ok(serviceLogFound)
    ok(!mainLogFound)
    ok(!traceFound)
  })

  test('should stream runtime logs filtering by level', async t => {
    const rootDir = await resolve(fixturesDir, 'main')
    const serviceDir = await resolve(rootDir, 'web/main')
    await ensureDependency(t, serviceDir, '@platformatic/node')
    await ensureDependency(t, serviceDir, 'fastify')

    t.after(() => {
      logsProcess.kill('SIGINT')
      startProcess.kill('SIGINT')

      Promise.all([startProcess.catch(() => {}), logsProcess.catch(() => {})])
    })

    const startProcess = wattpm('start', rootDir)

    for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
      const parsed = JSON.parse(log.toString())

      if (parsed.msg.startsWith('Platformatic is now listening')) {
        break
      }
    }

    const logsProcess = wattpm('logs', '-l', 'trace', 'main')
    const { mainLogFound, serviceLogFound, traceFound } = await matchLogs(logsProcess.stdout)

    ok(serviceLogFound)
    ok(mainLogFound)
    ok(traceFound)
  })

  test('should complain when a runtime is not found', async t => {
    const logsProcess = await wattpm('logs', 'p-' + Date.now.toString(), { reject: false })

    deepStrictEqual(logsProcess.exitCode, 1)
    ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
  })
})
