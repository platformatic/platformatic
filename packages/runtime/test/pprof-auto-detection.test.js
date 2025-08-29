import { ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { autoDetectPprofCapture } from '../lib/config.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

function isWattpmPprofCapturePreloaded (preload) {
  return preload.some(p => p.includes('wattpm-pprof-capture'))
}

test('should auto-detect @platformatic/wattpm-pprof-capture by default', async t => {
  // Use existing monorepo fixture which loads services
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')

  // Load config with runtime transformation
  const config = await loadConfiguration(configFile)

  // Check that pprof capture was auto-detected and added to preload
  const preload = config.preload
  ok(Array.isArray(preload), 'preload should be an array')
  ok(isWattpmPprofCapturePreloaded(preload), 'preload should include wattpm-pprof-capture by default')
})

test('auto-detect function works correctly', async t => {
  // Import the config module to access the auto-detect function

  // Test with empty config
  const config1 = {}
  autoDetectPprofCapture(config1)

  ok(Array.isArray(config1.preload), 'should create preload array')
  ok(isWattpmPprofCapturePreloaded(config1.preload), 'should include pprof capture by default')

  // Test with existing string preload
  const config2 = { preload: './existing.js' }
  autoDetectPprofCapture(config2)

  ok(Array.isArray(config2.preload), 'should convert string to array')
  ok(config2.preload.includes('./existing.js'), 'should preserve existing preload')
  ok(isWattpmPprofCapturePreloaded(config2.preload), 'should add pprof capture by default')

  // Test with existing array preload
  const config3 = { preload: ['./existing1.js', './existing2.js'] }
  autoDetectPprofCapture(config3)

  ok(config3.preload.includes('./existing1.js'), 'should preserve first existing preload')
  ok(config3.preload.includes('./existing2.js'), 'should preserve second existing preload')
  ok(isWattpmPprofCapturePreloaded(config3.preload), 'should add pprof capture by default')

  // Test with already existing pprof capture (should not duplicate)
  const existingPprofPath = join(import.meta.dirname, '..', '..', 'wattpm-pprof-capture', 'index.js')
  const config5 = { preload: [existingPprofPath] }
  autoDetectPprofCapture(config5)

  const pprofInstances = config5.preload.filter(p => p.includes('wattpm-pprof-capture'))
  strictEqual(pprofInstances.length, 1, 'should not duplicate pprof capture')
})
