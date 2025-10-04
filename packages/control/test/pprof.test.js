'use strict'

import { safeRemove } from '@platformatic/foundation'
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import * as errors from '../lib/errors.js'
import { RuntimeApiClient } from '../lib/index.js'
import { kill, startRuntime } from './helper.js'

function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

const fixturesDir = join(import.meta.dirname, 'fixtures')

test('should start profiling via RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start profiling on service-1
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000 })

  // Should not throw - successful start
  assert.ok(true, 'startApplicationProfiling should complete successfully')

  // Clean up - stop profiling
  await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1')
})

test('should stop profiling and return profile data via RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start profiling first
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000 })

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get profile data
  const profileData = await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1')

  // Should return binary profile data (ArrayBuffer)
  assert.ok(profileData instanceof ArrayBuffer, 'stopApplicationProfiling should return an ArrayBuffer')
  assert.ok(profileData.byteLength > 0, 'Profile data should not be empty')
})

test('should handle service not found error in RuntimeApiClient for start profiling', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Try to start profiling on non-existent service
  await assert.rejects(
    () => runtimeClient.startApplicationProfiling(runtime.pid, 'non-existent-service', { intervalMicros: 1000 }),
    errors.ServiceNotFound,
    'Should throw ServiceNotFound error for non-existent service'
  )
})

test('should handle service not found error in RuntimeApiClient for stop profiling', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Try to stop profiling on non-existent service
  await assert.rejects(
    () => runtimeClient.stopApplicationProfiling(runtime.pid, 'non-existent-service'),
    errors.ServiceNotFound,
    'Should throw ServiceNotFound error for non-existent service'
  )
})

test('should handle profiling already started error in RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start profiling
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000 })

  // Try to start profiling again - should throw error
  await assert.rejects(
    () => runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000 }),
    errors.ProfilingAlreadyStarted,
    'Should throw ProfilingAlreadyStarted error when profiling is already started'
  )

  // Clean up - stop profiling
  await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1')
})

test('should handle profiling not started error in RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Try to stop profiling when it's not started
  await assert.rejects(
    () => runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1'),
    errors.ProfilingNotStarted,
    'Should throw ProfilingNotStarted error when profiling is not started'
  )
})

test('should start heap profiling via RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start heap profiling on service-1
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000, type: 'heap' })

  // Should not throw - successful start
  assert.ok(true, 'startApplicationProfiling with heap type should complete successfully')

  // Clean up - stop profiling
  await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1', { type: 'heap' })
})

test('should stop heap profiling and return profile data via RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start heap profiling first
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000, type: 'heap' })

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get profile data
  const profileData = await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1', { type: 'heap' })

  // Should return binary profile data (ArrayBuffer)
  assert.ok(profileData instanceof ArrayBuffer, 'stopApplicationProfiling should return an ArrayBuffer')
  assert.ok(profileData.byteLength > 0, 'Profile data should not be empty')
})

test('should support concurrent cpu and heap profiling via RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start CPU profiling
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000, type: 'cpu' })

  // Start heap profiling (should work concurrently)
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000, type: 'heap' })

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop both and get profile data
  const cpuProfileData = await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1', { type: 'cpu' })
  const heapProfileData = await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1', { type: 'heap' })

  // Both should return binary profile data
  assert.ok(cpuProfileData instanceof ArrayBuffer, 'CPU profile should return an ArrayBuffer')
  assert.ok(cpuProfileData.byteLength > 0, 'CPU profile data should not be empty')
  assert.ok(heapProfileData instanceof ArrayBuffer, 'Heap profile should return an ArrayBuffer')
  assert.ok(heapProfileData.byteLength > 0, 'Heap profile data should not be empty')
})

test('should handle heap profiling already started error in RuntimeApiClient', async t => {
  const projectDir = join(fixturesDir, 'runtime-1')
  const configFile = join(projectDir, 'platformatic.json')

  const runtimeTmpDir = getRuntimeTmpDir(projectDir)
  await safeRemove(runtimeTmpDir)

  const { runtime } = await startRuntime(configFile)
  t.after(async () => {
    await kill(runtime)
    await safeRemove(runtimeTmpDir)
  })

  const runtimeClient = new RuntimeApiClient()

  // Start heap profiling
  await runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000, type: 'heap' })

  // Try to start heap profiling again - should throw error
  await assert.rejects(
    () => runtimeClient.startApplicationProfiling(runtime.pid, 'service-1', { intervalMicros: 1000, type: 'heap' }),
    errors.ProfilingAlreadyStarted,
    'Should throw ProfilingAlreadyStarted error when heap profiling is already started'
  )

  // Clean up - stop profiling
  await runtimeClient.stopApplicationProfiling(runtime.pid, 'service-1', { type: 'heap' })
})
