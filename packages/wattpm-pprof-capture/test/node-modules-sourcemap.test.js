import assert from 'node:assert'
import { resolve } from 'node:path'
import test from 'node:test'
import { loadNodeModulesSourceMaps } from '../lib/node-modules-sourcemaps.js'

// Unit test for loadNodeModulesSourceMaps
test('loadNodeModulesSourceMaps should load source maps from next package', async (t) => {
  // Get the path to the platformatic monorepo root (where next is installed)
  // From packages/wattpm-pprof-capture/test -> go up 3 levels to reach monorepo root
  const monorepoRoot = resolve(import.meta.dirname, '../../..')

  // Load source maps from the next package
  const entries = await loadNodeModulesSourceMaps(monorepoRoot, ['next'], false)

  // Verify that we found source maps
  assert.ok(entries.size > 0, `Should have found source maps in next package, found ${entries.size}`)

  // Verify the structure of entries
  for (const [generatedPath, info] of entries) {
    assert.ok(typeof generatedPath === 'string', 'Generated path should be a string')
    assert.ok(generatedPath.endsWith('.js') || generatedPath.endsWith('.cjs') || generatedPath.endsWith('.mjs'),
      `Generated path should end with .js, .cjs, or .mjs: ${generatedPath}`)
    assert.ok(info.mapFileDir, 'Info should have mapFileDir')
    assert.ok(info.mapConsumer, 'Info should have mapConsumer')
    assert.ok(typeof info.mapConsumer.originalPositionFor === 'function',
      'mapConsumer should have originalPositionFor method')
  }

  // Log some stats
  console.log(`Loaded ${entries.size} source maps from next package`)
})

// Unit test for loadNodeModulesSourceMaps with scoped package
test('loadNodeModulesSourceMaps should handle non-existent packages gracefully', async (t) => {
  const monorepoRoot = resolve(import.meta.dirname, '../../..')

  // Try to load from a non-existent package
  const entries = await loadNodeModulesSourceMaps(monorepoRoot, ['non-existent-package-12345'], false)

  // Should return empty map without throwing
  assert.strictEqual(entries.size, 0, 'Should return empty map for non-existent package')
})

// Unit test for loadNodeModulesSourceMaps with multiple packages
test('loadNodeModulesSourceMaps should load source maps from multiple packages', async (t) => {
  const monorepoRoot = resolve(import.meta.dirname, '../../..')

  // Load from multiple packages (next has source maps, fastify typically doesn't)
  const entries = await loadNodeModulesSourceMaps(monorepoRoot, ['next', 'fastify'], false)

  // Should have at least the next package's source maps
  assert.ok(entries.size > 0, 'Should have found source maps')
})

// Test that source map data can be used for lookups
test('loaded source maps should have valid mapping data', async (t) => {
  const monorepoRoot = resolve(import.meta.dirname, '../../..')

  const entries = await loadNodeModulesSourceMaps(monorepoRoot, ['next'], false)
  assert.ok(entries.size > 0, 'Should have source maps to test')

  // Pick a random entry and verify we can do a lookup
  const [generatedPath, info] = entries.entries().next().value

  // Try to get original position for line 1, column 0
  const pos = info.mapConsumer.originalPositionFor({ line: 1, column: 0 })

  // The position might be null if line 1 col 0 has no mapping,
  // but the function should not throw
  assert.ok(pos !== undefined, 'originalPositionFor should return a result')

  // Verify the sources array exists
  assert.ok(info.mapConsumer.sources, 'mapConsumer should have sources')
  assert.ok(Array.isArray(info.mapConsumer.sources), 'sources should be an array')

  console.log(`Tested lookup on ${generatedPath}`)
  console.log(`  Sources: ${info.mapConsumer.sources.length}`)
})
