'use strict'

import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'
import { ok, strictEqual } from 'node:assert'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should return runtime metrics when passing no options', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'metrics'])
  strictEqual(child.exitCode, 0)

  ok(child.stdout.includes('shared_trusted_large_object'))
  ok(child.stdout.includes('nodejs_version_info'))
  ok(child.stdout.includes('http_request_duration_seconds'))
  ok(child.stdout.includes('http_cache_hit_count'))
  ok(child.stdout.includes('process_cpu_system_seconds_total'))
})

test('should return runtime metrics when passing options', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = await execa('node', [cliPath, 'metrics', '-p', runtime.pid, '-f', 'text'])
  strictEqual(child.exitCode, 0)

  ok(child.stdout.includes('shared_trusted_large_object'))
  ok(child.stdout.includes('nodejs_version_info'))
  ok(child.stdout.includes('http_request_duration_seconds'))
  ok(child.stdout.includes('http_cache_hit_count'))
  ok(child.stdout.includes('process_cpu_system_seconds_total'))
})
