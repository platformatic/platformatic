import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

async function matchLogs (stream, requiresMainLog = true, requiresTraceLog = false) {
  let mainLogFound
  let serviceLogFound
  let traceFound

  function shouldExit () {
    if (requiresMainLog && !mainLogFound) {
      return false
    }

    if (requiresTraceLog && !traceFound) {
      return false
    }

    return true
  }

  for await (const log of on(stream.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (process.env.PLT_TESTS_VERBOSE === 'true') {
      process._rawDebug(parsed)
    }

    if (parsed.msg === 'This is a trace') {
      traceFound = true
      continue
    }

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      mainLogFound = true

      if (shouldExit()) {
        break
      }
    }

    if (parsed.msg.startsWith('Service listening') && parsed.name === 'main') {
      serviceLogFound = true

      if (shouldExit()) {
        break
      }
    }
  }

  return { mainLogFound, serviceLogFound, traceFound }
}

test('inject - should stream runtime logs', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const logs = matchLogs(logsProcess.stdout)

  // Restart services to trigger new logs
  setTimeout(() => {
    startProcess.kill('SIGUSR2')
  }, 500)

  const { mainLogFound, serviceLogFound, traceFound } = await logs
  ok(serviceLogFound)
  ok(mainLogFound)
  ok(!traceFound)
})

test('inject - should stream runtime logs filtering by service', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const logs = matchLogs(logsProcess.stdout, false)

  // Restart services to trigger new logs
  setTimeout(() => {
    startProcess.kill('SIGUSR2')
  }, 500)

  const { mainLogFound, serviceLogFound, traceFound } = await logs

  ok(serviceLogFound)
  ok(!mainLogFound)
  ok(!traceFound)
})

test('inject - should stream runtime logs filtering by level', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

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
  const logs = matchLogs(logsProcess.stdout, true, true)

  // Restart services to trigger new logs
  setTimeout(() => {
    startProcess.kill('SIGUSR2')
  }, 2000)

  const { mainLogFound, serviceLogFound, traceFound } = await logs

  ok(serviceLogFound)
  ok(mainLogFound)
  ok(traceFound)
})

test('inject - should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('logs', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})
