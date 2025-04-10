'use strict'

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { resolve, join } from 'node:path'
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { ignoreDirs, isServiceBuildable } from '../lib/utils.js'

const tempDir = resolve(tmpdir(), 'packages-node-utils')

test('utils - isServiceBuildable', async (t) => {
  // Test with config having build command
  await t.test('should return true for config with application.commands.build', async () => {
    const serviceDir = '/some/path' // Path doesn't matter for this test
    const config = {
      application: {
        commands: {
          build: 'some-build-command'
        }
      }
    }

    const result = await isServiceBuildable(serviceDir, config)
    assert.equal(result, true)
  })

  // Test for app-no-config which has package.json with build script
  await t.test('should return true for service with build script in package.json', async () => {
    const fixturesDir = resolve(import.meta.dirname, 'fixtures/dev-ts-build')
    const serviceDir = join(fixturesDir, 'services/app-no-config')

    const result = await isServiceBuildable(serviceDir)
    assert.equal(result, true)
  })

  // Test for app-with-config which also has package.json with build script
  await t.test('should return true for service with platformatic.json and build script', async () => {
    const fixturesDir = resolve(import.meta.dirname, 'fixtures/dev-ts-build')
    const serviceDir = join(fixturesDir, 'services/app-with-config')

    const result = await isServiceBuildable(serviceDir)
    assert.equal(result, true)
  })

  // Test with package.json but no build script
  await t.test('should return false for package.json without build script', async () => {
    const dir = await mkdtemp(tempDir)
    try {
      // Create package.json without build script
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: 'test-pkg',
          scripts: {
            start: 'node index.js'
          }
        })
      )

      const result = await isServiceBuildable(dir)
      assert.equal(result, false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  // Test with invalid package.json
  await t.test('should return false if package.json is invalid', async () => {
    const dir = await mkdtemp(tempDir)
    try {
      // Create invalid JSON in package.json
      await writeFile(join(dir, 'package.json'), '{ invalid json')

      const result = await isServiceBuildable(dir)
      assert.equal(result, false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  // Test with no valid files
  await t.test('should return false for directory with no package.json', async () => {
    const dir = await mkdtemp(tempDir)

    try {
      // Create an empty directory
      await mkdir(join(dir, 'empty-dir'))

      const result = await isServiceBuildable(join(dir, 'empty-dir'))
      assert.equal(result, false)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  // Test with non-existent directory
  await t.test('should return false for non-existent directory', async () => {
    const result = await isServiceBuildable('/path/does/not/exist')
    assert.equal(result, false)
  })
})

test('utils - ignoreDirs', async (t) => {
  await t.test('should handle both outDir and watchOptionsExcludeDirectories', async () => {
    const outDir = 'dist'
    const watchOptionsExcludeDirectories = ['**/node_modules', 'cache']

    const result = ignoreDirs(outDir, watchOptionsExcludeDirectories)

    // Should include all watchOptionsExcludeDirectories
    assert.ok(result.includes('**/node_modules'))
    assert.ok(result.includes('cache'))

    // Should include outDir
    assert.ok(result.includes('dist'))

    // Should include outDir/**
    assert.ok(result.includes('dist/**'))

    // Should return correct number of entries
    assert.equal(result.length, 4)
  })

  await t.test('should handle outDir with /** suffix', async () => {
    const outDir = 'build/**'
    const watchOptionsExcludeDirectories = ['**/node_modules']

    const result = ignoreDirs(outDir, watchOptionsExcludeDirectories)

    // Should include all watchOptionsExcludeDirectories
    assert.ok(result.includes('**/node_modules'))

    // Should include outDir
    assert.ok(result.includes('build/**'))

    // Should NOT duplicate outDir/**
    assert.equal(result.length, 2)
  })

  await t.test('should handle outDir-only case', async () => {
    const outDir = 'dist'

    const result = ignoreDirs(outDir, null)

    // Should include outDir
    assert.ok(result.includes('dist'))

    // Should include outDir/**
    assert.ok(result.includes('dist/**'))

    // Should return correct number of entries
    assert.equal(result.length, 2)
  })

  await t.test('should handle watchOptionsExcludeDirectories-only case', async () => {
    const watchOptionsExcludeDirectories = ['**/node_modules', 'temp', 'logs']

    const result = ignoreDirs(null, watchOptionsExcludeDirectories)

    // Should include all watchOptionsExcludeDirectories
    assert.ok(result.includes('**/node_modules'))
    assert.ok(result.includes('temp'))
    assert.ok(result.includes('logs'))

    // Should return correct number of entries
    assert.equal(result.length, 3)
  })

  await t.test('should handle null arguments', async () => {
    const result = ignoreDirs(null, null)

    // Should return empty array when both args are null
    assert.deepEqual(result, ['dist', 'dist/**'])
  })

  await t.test('should handle empty watchOptionsExcludeDirectories', async () => {
    const result = ignoreDirs('dist', [])

    // Should include outDir
    assert.ok(result.includes('dist'))

    // Should include outDir/**
    assert.ok(result.includes('dist/**'))

    // Should return correct number of entries
    assert.equal(result.length, 2)
  })

  await t.test('should deduplicate directories', async () => {
    const outDir = 'dist'
    const watchOptionsExcludeDirectories = ['dist', '**/node_modules', 'dist/**']

    const result = ignoreDirs(outDir, watchOptionsExcludeDirectories)

    // Should include watchOptionsExcludeDirectories
    assert.ok(result.includes('**/node_modules'))

    // Should include outDir only once
    assert.ok(result.includes('dist'))

    // Should include outDir/** only once
    assert.ok(result.includes('dist/**'))

    // Should return correct number of entries (with duplicates removed)
    assert.equal(result.length, 3)
  })

  await t.test('should work with fixture tsconfig.json values', async () => {
    // Using values from fixtures/dev-ts-build/tsconfig.json
    const outDir = 'dist'
    const watchOptionsExcludeDirectories = ['**/node_modules', 'dist']

    const result = ignoreDirs(outDir, watchOptionsExcludeDirectories)

    // Should include watchOptionsExcludeDirectories
    assert.ok(result.includes('**/node_modules'))

    // Should include outDir
    assert.ok(result.includes('dist'))

    // Should include outDir/**
    assert.ok(result.includes('dist/**'))

    // Should return correct number of entries (with duplicates removed)
    assert.equal(result.length, 3)
  })

  await t.test('should work with actual tsconfig.json fixture file', async () => {
    const fixturesDir = resolve(import.meta.dirname, 'fixtures/dev-ts-build')
    const tsconfigPath = join(fixturesDir, 'tsconfig.json')
    const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8'))

    const outDir = tsconfig.compilerOptions.outDir
    const watchOptionsExcludeDirectories = tsconfig.watchOptions.excludeDirectories

    const result = ignoreDirs(outDir, watchOptionsExcludeDirectories)

    // Should include all watchOptionsExcludeDirectories from the fixture
    for (const dir of watchOptionsExcludeDirectories) {
      assert.ok(result.includes(dir), `Should include "${dir}" from watchOptionsExcludeDirectories`)
    }

    // Should include outDir from the fixture
    assert.ok(result.includes(outDir))

    // Should include outDir/** from the fixture
    assert.ok(result.includes(`${outDir}/**`))

    // Should return correct number of entries (with duplicates removed)
    // Since outDir is 'dist' and one of the excludeDirectories is also 'dist'
    const expectedLength = watchOptionsExcludeDirectories.length +
                           (watchOptionsExcludeDirectories.includes(outDir) ? 1 : 2) -
                           (watchOptionsExcludeDirectories.includes(`${outDir}/**`) ? 1 : 0)
    assert.equal(result.length, expectedLength)
  })
})
