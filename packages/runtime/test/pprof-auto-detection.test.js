'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('..')

const fixturesDir = join(__dirname, '..', 'fixtures')

test('should auto-detect @platformatic/watt-pprof-capture by default', async (t) => {
  // Ensure PLT_DISABLE_FLAMEGRAPHS is not set
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  delete process.env.PLT_DISABLE_FLAMEGRAPHS
  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    }
  })

  // Use existing monorepo fixture which loads services
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')

  // Load config with runtime transformation
  const result = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const configManager = result.configManager

  // Check that pprof capture was auto-detected and added to preload
  const preload = configManager.current.preload
  assert.ok(Array.isArray(preload), 'preload should be an array')
  assert.ok(preload.some(p => p.includes('watt-pprof-capture')), 'preload should include watt-pprof-capture by default')
})

test('should not auto-detect when PLT_DISABLE_FLAMEGRAPHS is set', async (t) => {
  const originalEnv = process.env.PLT_DISABLE_FLAMEGRAPHS
  process.env.PLT_DISABLE_FLAMEGRAPHS = '1'
  t.after(() => {
    if (originalEnv !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalEnv
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
  })

  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const result = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const configManager = result.configManager

  // Should not have any preload or should not include pprof capture
  const preload = configManager.current.preload || []
  assert.ok(!preload.some(p => p.includes('watt-pprof-capture')), 'preload should not include watt-pprof-capture when disabled')
})

test('auto-detect function works correctly', async (t) => {
  // Import the config module to access the auto-detect function
  const { autoDetectPprofCapture } = require('../lib/config')

  const originalDisable = process.env.PLT_DISABLE_FLAMEGRAPHS
  delete process.env.PLT_DISABLE_FLAMEGRAPHS
  t.after(() => {
    if (originalDisable !== undefined) {
      process.env.PLT_DISABLE_FLAMEGRAPHS = originalDisable
    } else {
      delete process.env.PLT_DISABLE_FLAMEGRAPHS
    }
  })

  // Test with empty config
  const config1 = {}
  autoDetectPprofCapture(config1)

  assert.ok(Array.isArray(config1.preload), 'should create preload array')
  assert.ok(config1.preload.some(p => p.includes('watt-pprof-capture')), 'should include pprof capture by default')

  // Test with existing string preload
  const config2 = { preload: './existing.js' }
  autoDetectPprofCapture(config2)

  assert.ok(Array.isArray(config2.preload), 'should convert string to array')
  assert.ok(config2.preload.includes('./existing.js'), 'should preserve existing preload')
  assert.ok(config2.preload.some(p => p.includes('watt-pprof-capture')), 'should add pprof capture by default')

  // Test with existing array preload
  const config3 = { preload: ['./existing1.js', './existing2.js'] }
  autoDetectPprofCapture(config3)

  assert.ok(config3.preload.includes('./existing1.js'), 'should preserve first existing preload')
  assert.ok(config3.preload.includes('./existing2.js'), 'should preserve second existing preload')
  assert.ok(config3.preload.some(p => p.includes('watt-pprof-capture')), 'should add pprof capture by default')

  // Test with disabled environment variable
  process.env.PLT_DISABLE_FLAMEGRAPHS = '1'

  const config4 = {}
  autoDetectPprofCapture(config4)

  assert.ok(!config4.preload || config4.preload.length === 0, 'should not add preload when disabled')

  // Test with already existing pprof capture (should not duplicate)
  delete process.env.PLT_DISABLE_FLAMEGRAPHS
  const existingPprofPath = join(__dirname, '..', '..', 'watt-pprof-capture', 'index.js')
  const config5 = { preload: [existingPprofPath] }
  autoDetectPprofCapture(config5)

  const pprofInstances = config5.preload.filter(p => p.includes('watt-pprof-capture'))
  assert.strictEqual(pprofInstances.length, 1, 'should not duplicate pprof capture')
})
