import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  configurationFileNames,
  hasConfigurationFile,
  inspectDirectory,
  isConfigurationFileName,
  isLegacyConfigurationFileName,
  legacyConfigurationFileNames,
  selectConfigurationFileNames
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

test('the recognized set is exactly the four v4 filenames', () => {
  deepStrictEqual(configurationFileNames, ['watt.config.ts', 'watt.config.mts', 'watt.config.js', 'watt.config.mjs'])
  ok(isConfigurationFileName('watt.config.mjs'))
  ok(!isConfigurationFileName('watt.config.cjs'))
  ok(!isConfigurationFileName('vite.config.ts'))
})

test('legacy detection covers the complete v3 candidate set, not just .json', () => {
  // The whole point of the unconditional check is that a watt.yaml-only project cannot fall
  // through to zero-config synthesis while its real configuration is ignored.
  for (const name of ['watt.json', 'watt.yaml', 'watt.toml', 'platformatic.json5', 'platformatic.db.yml']) {
    ok(isLegacyConfigurationFileName(name), `${name} should be recognized as legacy`)
  }

  ok(!isLegacyConfigurationFileName('watt.config.ts'))
  ok(!isLegacyConfigurationFileName('package.json'))
  strictEqual(legacyConfigurationFileNames.length, 6 * 2 + 6 * 6 * 2)
})

test('candidates are reported in the canonical extension order, not the directory order', async t => {
  const root = await createTree(t, { 'watt.config.mjs': '', 'watt.config.ts': '' })

  deepStrictEqual(selectConfigurationFileNames(['watt.config.mjs', 'watt.config.ts']), [
    'watt.config.ts',
    'watt.config.mjs'
  ])

  await rejects(() => inspectDirectory(root), error => {
    strictEqual(error.code, 'PLT_AMBIGUOUS_CONFIGURATION_FILE')
    ok(error.message.includes('watt.config.ts, watt.config.mjs'))
    return true
  })
})

test('a directory with exactly one candidate resolves to it', async t => {
  const root = await createTree(t, { 'watt.config.ts': '' })

  strictEqual(await inspectDirectory(root), join(root, 'watt.config.ts'))
})

test('a directory with no candidate resolves to null, and a missing directory is not an error', async t => {
  const root = await createTree(t, { 'package.json': '{}' })

  strictEqual(await inspectDirectory(root), null)
  strictEqual(await inspectDirectory(join(root, 'nope')), null)
  strictEqual(await hasConfigurationFile(join(root, 'nope')), false)
})

test('a legacy file is an error even next to a v4 file', async t => {
  const root = await createTree(t, { 'watt.config.ts': '', 'watt.yaml': '' })

  await rejects(() => inspectDirectory(root), error => {
    strictEqual(error.code, 'PLT_LEGACY_CONFIGURATION_FILE')
    ok(error.message.includes('watt.yaml'))
    ok(error.message.includes('npx wattpm-utils@4 migrate'))
    return true
  })
})

test('the legacy check precedes the ambiguity check, so the migrate hint is never shadowed', async t => {
  const root = await createTree(t, { 'watt.config.ts': '', 'watt.config.js': '', 'platformatic.json': '{}' })

  await rejects(() => inspectDirectory(root), { code: 'PLT_LEGACY_CONFIGURATION_FILE' })
})

test('the env-root scan is a presence check that never raises ambiguity', async t => {
  // It executes nothing and decides nothing about which configuration boots: a directory with two
  // candidates still has a configuration in it, which is all this question asks.
  const root = await createTree(t, { 'watt.config.ts': '', 'watt.config.js': '' })

  strictEqual(await hasConfigurationFile(root), true)
})
