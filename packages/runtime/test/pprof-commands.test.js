import { equal, ok, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { transform } from '../lib/config.js'
import { MissingPprofCapture } from '../lib/errors.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should start profiling for a service', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Test starting profiling on a application
  const result = await app.startApplicationProfiling('with-logger', { intervalMicros: 1000 })

  // Should not throw and complete successfully
  // The actual ITC handler in wattpm-pprof-capture will handle the profiling logic
  ok(typeof result === 'undefined' || result === null, 'startApplicationProfiling should not return a value')
})

test('should stop profiling for a service and return profile data', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Start profiling first
  await app.startApplicationProfiling('with-logger', { intervalMicros: 1000 })

  // Wait a bit for some profile data to be collected
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get the profile data
  const profileData = await app.stopApplicationProfiling('with-logger')

  // Should return binary profile data (Buffer or Uint8Array)
  ok(
    Buffer.isBuffer(profileData) || profileData instanceof Uint8Array,
    'stopApplicationProfiling should return a Buffer or Uint8Array'
  )
  ok(profileData.length > 0, 'Profile data should not be empty')
})

test('should throw error when starting profiling on non-existent service', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Try to start profiling on a service that doesn't exist
  await rejects(
    () => app.startApplicationProfiling('non-existent-service', {}),
    err => {
      ok(err.message.includes('Service not found') || err.message.includes('non-existent-service'))
      return true
    },
    'Should throw error for non-existent service'
  )
})

test('should throw error when stopping profiling on non-existent service', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Try to stop profiling on a service that doesn't exist
  await rejects(
    () => app.stopApplicationProfiling('non-existent-service'),
    err => {
      ok(err.message.includes('Service not found') || err.message.includes('non-existent-service'))
      return true
    },
    'Should throw error for non-existent service'
  )
})

test('should handle profiling already started error', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Start profiling
  await app.startApplicationProfiling('with-logger', { intervalMicros: 1000 })

  // Try to start profiling again - should throw an error
  await rejects(
    () => app.startApplicationProfiling('with-logger', { intervalMicros: 1000 }),
    err => {
      // The error should indicate profiling is already started
      ok(err.message.includes('already') || err.message.includes('started'))
      return true
    },
    'Should throw error when profiling is already started'
  )

  // Clean up - stop profiling
  await app.stopApplicationProfiling('with-logger')
})

test('should handle profiling not started error', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  // Try to stop profiling when it's not started
  await rejects(
    () => app.stopApplicationProfiling('with-logger'),
    err => {
      // The error should indicate profiling is not started
      ok(err.message.includes('not started') || err.message.includes('not running'))
      return true
    },
    'Should throw error when profiling is not started'
  )
})

test('runtime errors if wattpm-pprof-capture is not loaded', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const runtime = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      equal(
        config.preload.includes('@platformatic/wattpm-pprof-capture') ||
          config.preload.some(p => p.includes('wattpm-pprof-capture')),
        true,
        'pprof capture should be in preload'
      )

      config.preload = [] // Remove pprof capture to simulate user error

      return config
    }
  })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  await runtime.start()

  await rejects(runtime.startApplicationProfiling('with-logger'), new MissingPprofCapture())
})

test('runtime errors if wattpm-pprof-capture is not loaded (stop)', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const runtime = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)

      equal(
        config.preload.includes('@platformatic/wattpm-pprof-capture') ||
          config.preload.some(p => p.includes('wattpm-pprof-capture')),
        true,
        'pprof capture should be in preload'
      )

      config.preload = [] // Remove pprof capture to simulate user error

      return config
    }
  })

  t.after(async () => {
    await runtime.close()
  })

  await runtime.init()

  await runtime.start()

  await rejects(runtime.stopApplicationProfiling('with-logger'), new MissingPprofCapture())
})
