import { ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  findAncestorConfiguration,
  findApplicationConfigurationFile,
  findDecidingFile,
  findEnvRoot,
  findPackageBoundary,
  listAncestorCandidatePaths,
  resolveNamedConfigurationFile,
  scanAncestorConfigurations
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

test('the deciding file is the nearest watt.config.* from the current directory upward', async t => {
  const root = await createTree(t, {
    'package.json': '{}',
    'watt.config.ts': '',
    'web/frontend/package.json': '{}',
    'web/frontend/src/index.js': ''
  })

  // From the project root: its own file.
  const fromRoot = await findDecidingFile(root)
  strictEqual(fromRoot.path, join(root, 'watt.config.ts'))

  // From an application that owns no file: the search stops at that application's own
  // package.json, so the root's configuration is never reached and nothing decides.
  strictEqual(await findDecidingFile(join(root, 'web/frontend')), null)
})

test('an application that owns a config file decides for itself', async t => {
  const root = await createTree(t, {
    'package.json': '{}',
    'watt.config.ts': '',
    'web/frontend/package.json': '{}',
    'web/frontend/watt.config.ts': '',
    'web/frontend/src/pages/index.js': ''
  })

  const found = await findDecidingFile(join(root, 'web/frontend/src/pages'))

  strictEqual(found.path, join(root, 'web/frontend/watt.config.ts'))
  strictEqual(found.stopDirectory, join(root, 'web/frontend'))
})

test('the search never leaves your package', async t => {
  // A watt.config.* above your package.json belongs to something else. This is the whole of the
  // trust story: a stray ~/watt.config.ts is never found, because reaching it would mean walking
  // out of the package you are standing in.
  const root = await createTree(t, {
    'watt.config.ts': '',
    'inner/package.json': '{}',
    'inner/src/index.js': ''
  })

  strictEqual(await findPackageBoundary(join(root, 'inner/src')), join(root, 'inner'))
  strictEqual(await findDecidingFile(join(root, 'inner/src')), null)
})

test('a directory with a package.json is both searched and used as the stop', async t => {
  const root = await createTree(t, { 'inner/package.json': '{}', 'inner/watt.config.mts': '' })

  const found = await findDecidingFile(join(root, 'inner'))

  strictEqual(found.path, join(root, 'inner/watt.config.mts'))
  strictEqual(found.directory, join(root, 'inner'))
})

test('a legacy file in a consulted directory is an error, even below the file that would decide', async t => {
  const root = await createTree(t, {
    'package.json': '{}',
    'watt.config.ts': '',
    'nested/platformatic.service.json': '{}'
  })

  await rejects(() => findDecidingFile(join(root, 'nested')), { code: 'PLT_LEGACY_CONFIGURATION_FILE' })
})

test('a missing configuration can be reported rather than returned', async t => {
  const root = await createTree(t, { 'package.json': '{}' })

  await rejects(() => findDecidingFile(root, { throwOnMissing: true }), { code: 'PLT_CONFIGURATION_FILE_NOT_FOUND' })
})

test('--config names any of the four v4 files and refuses a v3 one with the migrate hint', async t => {
  const root = await createTree(t, { 'watt.config.mjs': '', 'watt.json': '{}' })

  const named = await resolveNamedConfigurationFile('watt.config.mjs', root)
  strictEqual(named.path, join(root, 'watt.config.mjs'))
  strictEqual(named.directory, root)

  await rejects(() => resolveNamedConfigurationFile('watt.json', root), { code: 'PLT_LEGACY_CONFIGURATION_FILE' })
  await rejects(() => resolveNamedConfigurationFile('watt.config.cjs', root), {
    code: 'PLT_CONFIGURATION_FILE_NOT_FOUND'
  })
  await rejects(() => resolveNamedConfigurationFile('watt.config.ts', root), {
    code: 'PLT_CONFIGURATION_FILE_NOT_FOUND'
  })
})

test('the env root is the outermost watt.config.* above a directory, not the nearest', async t => {
  const root = await createTree(t, {
    'watt.config.ts': '',
    'tools/sandbox/watt.config.ts': '',
    'tools/sandbox/src/index.js': ''
  })

  // A nested runtime inherits the chain above it: proj/tools/sandbox reads proj/.env.
  strictEqual(await findEnvRoot(join(root, 'tools/sandbox')), root)

  const found = await scanAncestorConfigurations(join(root, 'tools/sandbox'))
  strictEqual(found[0], join(root, 'tools/sandbox'))
  strictEqual(found[found.length - 1], root)
})

test('a directory with no configuration above it is its own env root', async t => {
  // Every chain terminates: the own-directory floor is what gives Level 0, the programmatic API
  // and a hot-added absolute path a terminator.
  const root = await createTree(t, { 'shared/worker/index.js': '' })
  const directory = join(root, 'shared/worker')

  strictEqual(await findEnvRoot(directory), directory)
})

test('the watched horizon runs the full distance the scan would walk', async t => {
  // Watching only as far as the current env root cannot see a configuration appearing above it,
  // which is exactly the event that moves the root outward.
  const root = await createTree(t, { 'a/b/index.js': '' })
  const paths = listAncestorCandidatePaths(join(root, 'a/b'))

  ok(paths.includes(join(root, 'a/b/watt.config.ts')))
  ok(paths.includes(join(root, 'a/watt.config.ts')))
  ok(paths.includes(join(root, 'watt.config.ts')))
  ok(paths.some(path => path.endsWith('watt.config.mjs')))
})

test('the standalone warning looks strictly above the application directory', async t => {
  const root = await createTree(t, { 'watt.config.ts': '', 'web/frontend/watt.config.ts': '' })

  strictEqual(await findAncestorConfiguration(join(root, 'web/frontend')), root)
  strictEqual(await findAncestorConfiguration(root), null)
})

test('per-app discovery skips the candidate that is the deciding file itself', async t => {
  // Without that, defineConfig({ application: { workers: 2 } }) in a bare repository — whose entry
  // has a defaulted path and no inline config — would discover its own root config.
  const root = await createTree(t, { 'watt.config.ts': '' })
  const deciding = join(root, 'watt.config.ts')

  strictEqual(await findApplicationConfigurationFile(root, deciding), null)
  strictEqual(await findApplicationConfigurationFile(root, join(root, 'other.ts')), deciding)
})
