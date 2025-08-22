import { LOGS_TIMEOUT } from '@platformatic/runtime/test/helpers.js'
import { deepStrictEqual, ok } from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

async function matchLogs (stream, requiresMainLog = true, requiresTraceLog = false) {
  let mainLogFound
  let applicationLogFound
  let traceFound
  let acInstalled = false
  const ac = new AbortController()
  const messages = []

  function updateStatus () {
    if (requiresMainLog && !mainLogFound) {
      return false
    }

    if (requiresTraceLog && !traceFound) {
      return false
    }

    if (!acInstalled) {
      acInstalled = true
      setTimeout(() => {
        ac.abort()
      }, LOGS_TIMEOUT).unref()
    }

    return true
  }

  try {
    for await (const log of on(stream.pipe(split2()), 'data', { signal: ac.signal })) {
      const parsed = JSON.parse(log.toString())

      if (process.env.PLT_TESTS_VERBOSE === 'true') {
        process._rawDebug(parsed)
      }

      messages.push(parsed)

      if (parsed.msg === 'This is a trace') {
        traceFound = true
        updateStatus()
      }

      if (parsed.msg.startsWith('Platformatic is now listening')) {
        mainLogFound = true
        updateStatus()
      }

      if (parsed.msg.startsWith('Service listening') && parsed.name === 'main') {
        applicationLogFound = true
        updateStatus()
      }
    }
  } catch (e) {
    if (e.code !== 'ABORT_ERR') {
      throw e
    }
  }

  return { messages, mainLogFound, applicationLogFound, traceFound }
}

test('inject - should stream runtime logs', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    logsProcess.kill('SIGINT')
    startProcess.kill('SIGINT')

    Promise.all([startProcess.catch(() => {}), logsProcess.catch(() => {})])
  })

  const startProcess = wattpm('start', rootDir, { env: { PLT_TESTS_DELAY_START: true } })

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg === 'Runtime event' && parsed.event === 'init') {
      break
    }
  }

  const logsProcess = wattpm('logs', 'main')
  const logs = matchLogs(logsProcess.stdout)

  const { mainLogFound, applicationLogFound, traceFound } = await logs
  ok(applicationLogFound)
  ok(mainLogFound)
  ok(!traceFound)
})

test('logs - should stream runtime logs filtering by application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    logsProcess.kill('SIGINT')
    startProcess.kill('SIGINT')

    Promise.all([startProcess.catch(() => {}), logsProcess.catch(() => {})])
  })

  const startProcess = wattpm('start', rootDir, { env: { PLT_TESTS_DELAY_START: true } })

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg === 'Runtime event' && parsed.event === 'init') {
      break
    }
  }

  const logsProcess = wattpm('logs', 'main', 'main')
  const logs = matchLogs(logsProcess.stdout, false)

  const { mainLogFound, applicationLogFound, traceFound } = await logs

  ok(applicationLogFound)
  ok(!mainLogFound)
  ok(!traceFound)
})

test('logs - should stream runtime logs filtering by level', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
    logsProcess.kill('SIGINT')
    startProcess.kill('SIGINT')

    Promise.all([startProcess.catch(() => {}), logsProcess.catch(() => {})])
  })

  const startProcess = wattpm('start', rootDir, { env: { PLT_TESTS_DELAY_START: true } })

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg === 'Runtime event' && parsed.event === 'init') {
      break
    }
  }

  const logsProcess = wattpm('logs', '-l', 'trace', 'main')
  const logs = matchLogs(logsProcess.stdout, true, true)

  const { mainLogFound, applicationLogFound, traceFound } = await logs

  ok(applicationLogFound)
  ok(mainLogFound)
  ok(traceFound)
})

test('logs - should complain when a runtime is not found', async t => {
  const logsProcess = await wattpm('logs', 'p-' + Date.now.toString(), { reject: false })

  deepStrictEqual(logsProcess.exitCode, 1)
  ok(logsProcess.stdout.includes('Cannot find a matching runtime.'))
})
