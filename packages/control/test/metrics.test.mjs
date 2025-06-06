'use strict'

import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'
import { ok, strictEqual } from 'node:assert'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should return runtime metrics when passing no format option', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'metrics', '-p', runtime.pid])
  strictEqual(child.exitCode, 0)

  ok(child.stdout.includes('"nodejs_version_info"'))
  ok(child.stdout.includes('"http_request_all_duration_seconds"'))
  ok(child.stdout.includes('"http_cache_hit_count"'))
  ok(child.stdout.includes('"process_cpu_system_seconds_total"'))
})

test('should return runtime metrics when passing text option', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'metrics', '-p', runtime.pid, '-f', 'text'])
  strictEqual(child.exitCode, 0)

  ok(child.stdout.includes('# TYPE nodejs_version_info gauge'))
  ok(child.stdout.includes('# TYPE http_request_all_duration_seconds histogram'))
  ok(child.stdout.includes('# TYPE http_cache_hit_count counter'))
  ok(child.stdout.includes('# TYPE thread_cpu_seconds_total counter'))
})
