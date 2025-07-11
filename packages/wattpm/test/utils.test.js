import { deepEqual, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { findRuntimeConfigurationFile, getPackageArgs } from '../lib/utils.js'

test('utils - findRuntimeConfigurationFile - should search for configuration file when none is passed', async () => {
  let fatalCalled = false
  const logger = {
    fatal: () => {
      fatalCalled = true
    }
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'wattpm-tests-'))

  try {
    const subDir = join(tmpDir, 'subdir')
    await mkdir(subDir, { recursive: true })

    const configFilePath = join(tmpDir, 'watt.json')
    await writeFile(
      configFilePath,
      JSON.stringify({
        $schema: 'https://platformatic.dev/schemas/v1.0.0/runtime'
      })
    )

    const result = await findRuntimeConfigurationFile(logger, subDir)

    strictEqual(result, resolve(configFilePath), 'Should find configuration file in parent directory')
    strictEqual(fatalCalled, false, 'Should not call fatal when configuration file is found')
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
})

test('utils - findRuntimeConfigurationFile - should return resolved path when configuration file is passed', async () => {
  const logger = {
    fatal: () => {}
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'wattpm-tests-'))

  try {
    const configFilePath = join(tmpDir, 'watt.json')
    await writeFile(
      configFilePath,
      JSON.stringify({
        $schema: 'https://platformatic.dev/schemas/v1.0.0/runtime'
      })
    )

    const result = await findRuntimeConfigurationFile(logger, tmpDir, configFilePath)
    strictEqual(result, resolve(configFilePath), 'Should return the resolved path of the passed configuration file')
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
})

test('utils - getPackageArgs - should return the right package args', () => {
  deepEqual(getPackageArgs(), ['install'], 'no args passed')
  deepEqual(getPackageArgs('yarn'), ['install'], 'yarn passed, no prod')
  deepEqual(getPackageArgs('pnpm', true), ['install', '--prod'], 'pnpm passed, prod mode')
  deepEqual(getPackageArgs('npm', true), ['install', '--omit=dev'], 'npm passed, prod mode')
})
