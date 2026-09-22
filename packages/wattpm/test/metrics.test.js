import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { parseRuntimeLog, wattpm, wattpmNoRuntime } from './helper.js'
import { deepStrictEqual, ok } from 'node:assert'

test('metrics - should return runtime metrics without format opt', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = parseRuntimeLog(log)

    if (!parsed) {
      continue
    }

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const logsProcess = await wattpm('metrics')

  ok(logsProcess.stdout.includes('"nodejs_version_info"'))
  ok(logsProcess.stdout.includes('"http_request_all_duration_seconds"'))
  ok(logsProcess.stdout.includes('"http_cache_hit_count"'))
  ok(logsProcess.stdout.includes('"process_cpu_system_seconds_total"'))
})

test('metrics - should return runtime metrics with text format', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')

  t.after(() => {
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = parseRuntimeLog(log)

    if (!parsed) {
      continue
    }

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const logsProcess = await wattpm('metrics', '-f', 'text')
  ok(logsProcess.stdout.includes('# TYPE nodejs_version_info gauge'))
  ok(logsProcess.stdout.includes('# TYPE http_request_all_duration_seconds histogram'))
  ok(logsProcess.stdout.includes('# TYPE http_cache_hit_count counter'))
  ok(logsProcess.stdout.includes('# TYPE thread_cpu_seconds_total counter'))
})

test('metrics - should handle no matching runtime', async t => {
  // From a throwaway directory: getMatchingRuntime otherwise falls back to a sibling runtime still
  // shutting down in the shared package directory, so "no runtime" flakily finds one.
  const metricsProcess = await wattpmNoRuntime(t, 'metrics', { reject: false })

  deepStrictEqual(metricsProcess.exitCode, 1)
  ok(metricsProcess.stdout.includes('Cannot find a matching runtime'))
})
