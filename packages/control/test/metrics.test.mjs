'use strict'

import { test } from 'node:test'
import { join } from 'node:path'
import { execa } from 'execa'
import * as desm from 'desm'
import { startRuntime, kill } from './helper.mjs'

const cliPath = desm.join(import.meta.url, '..', 'control.js')
const fixturesDir = desm.join(import.meta.url, 'fixtures')

test('should return runtime metrics', async (t) => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')
  const { runtime } = await startRuntime(configFile)
  t.after(() => kill(runtime))

  const child = execa('node', [cliPath, 'metrics'])
  t.after(() => kill(child))

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 30000)

  return new Promise((resolve) => {
    let output = ''
    child.stdout.on('data', (data) => {
      output += data.toString()
      if (output.includes('shared_trusted_large_object') && output.includes('nodejs_version_info') && output.includes('http_request_duration_seconds') && output.includes('http_cache_hit_count') && output.includes('process_cpu_system_seconds_total')) {
        clearTimeout(errorTimeout)
        resolve()
      }
    })
  })
})
