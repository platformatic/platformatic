import { ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { autoDetectPprofCapture } from '../lib/config.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should auto-detect @platformatic/watt-pprof-capture by default', async t => {
  // Use existing monorepo fixture which loads services
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')

  // Load config with runtime transformation
  const config = await loadConfiguration(configFile)

  // Check that pprof capture was auto-detected and added to preload
  const preload = config.preload
  ok(Array.isArray(preload), 'preload should be an array')
  ok(
    preload.some(p => p.includes('watt-pprof-capture')),
    'preload should include watt-pprof-capture by default'
  )
})

test('auto-detect function works correctly', async t => {
  // Import the config module to access the auto-detect function

  // Test with empty config
  const config1 = {}
  autoDetectPprofCapture(config1)

  ok(Array.isArray(config1.preload), 'should create preload array')
  ok(
    config1.preload.some(p => p.includes('watt-pprof-capture')),
    'should include pprof capture by default'
  )

  // Test with existing string preload
  const config2 = { preload: './existing.js' }
  autoDetectPprofCapture(config2)

  ok(Array.isArray(config2.preload), 'should convert string to array')
  ok(config2.preload.includes('./existing.js'), 'should preserve existing preload')
  ok(
    config2.preload.some(p => p.includes('watt-pprof-capture')),
    'should add pprof capture by default'
  )

  // Test with existing array preload
  const config3 = { preload: ['./existing1.js', './existing2.js'] }
  autoDetectPprofCapture(config3)

  ok(config3.preload.includes('./existing1.js'), 'should preserve first existing preload')
  ok(config3.preload.includes('./existing2.js'), 'should preserve second existing preload')
  ok(
    config3.preload.some(p => p.includes('watt-pprof-capture')),
    'should add pprof capture by default'
  )

  // Test with already existing pprof capture (should not duplicate)
  const existingPprofPath = join(import.meta.dirname, '..', '..', 'watt-pprof-capture', 'index.js')
  const config5 = { preload: [existingPprofPath] }
  autoDetectPprofCapture(config5)

  const pprofInstances = config5.preload.filter(p => p.includes('watt-pprof-capture'))
  strictEqual(pprofInstances.length, 1, 'should not duplicate pprof capture')
})
