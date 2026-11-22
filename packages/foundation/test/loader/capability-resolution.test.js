import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  checkCapabilityVersionSkew,
  checkPackageVersion,
  compareCapabilityVersions,
  loadAdditionalApplications,
  loadConfiguration,
  loadObjectConfiguration,
  resolveCapabilityPackage
} from '../../lib/loader/index.js'
import { createTree } from './helper.js'
import { versionCases } from './version-cases.js'

test('capability comparison follows the shared version policy in both directions', () => {
  for (const [left, right, expected] of versionCases) {
    for (const [index, policy] of [undefined, 'warn', 'error'].entries()) {
      strictEqual(compareCapabilityVersions(left, right, policy).level, expected[index])
      strictEqual(compareCapabilityVersions(right, left, policy).level, expected[index])
    }
  }
})

function fakePackage (name, version, extra = {}) {
  return {
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, version, main: 'index.js', ...extra }),
    [`node_modules/${name}/index.js`]: 'export const marker = true\n'
  }
}

test('resolution is application-scoped first', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...fakePackage('semver', '0.0.1-fake')
  })

  const resolved = resolveCapabilityPackage('semver', root)

  strictEqual(resolved.scope, 'application')
  strictEqual(resolved.version, '0.0.1-fake')
})

test('the runtime-bundled copy is the fallback, not the first choice', async t => {
  // Inverting the previous order is what makes the stamp check implementable: it compares the factory's copy
  // against the copy the worker will run, and a check resolving application-first against a worker
  // resolving lexically would compare a copy nobody executes.
  const root = await createTree(t, { 'package.json': '{ "name": "app" }' })
  const resolved = resolveCapabilityPackage('semver', root)

  strictEqual(resolved.scope, 'runtime')
  ok(resolved.version)
})

test('a package whose exports map hides its manifest still resolves', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...fakePackage('@acme/hidden', '2.3.4', { type: 'module', exports: { '.': './index.js' } })
  })

  const resolved = resolveCapabilityPackage('@acme/hidden', root)

  strictEqual(resolved.version, '2.3.4')
  ok(resolved.path.endsWith(join('@acme', 'hidden')))
})

test('a module resolvable from neither scope names both the module and the root', async t => {
  const root = await createTree(t, { 'package.json': '{ "name": "app" }' })

  throws(() => resolveCapabilityPackage('@platformatic/definitely-not-installed', root), error => {
    strictEqual(error.code, 'PLT_CAPABILITY_NOT_RESOLVABLE')
    ok(error.message.includes('@platformatic/definitely-not-installed'))
    ok(error.message.includes(root))
    return true
  })
})

test('major is an error, minor a warning, patch ignored', () => {
  deepStrictEqual(compareCapabilityVersions('4.0.0', '4.0.9'), { level: 'ok', reason: 'compatible' })
  deepStrictEqual(compareCapabilityVersions('4.1.0', '4.0.0'), { level: 'warning', reason: 'minor-mismatch' })
  deepStrictEqual(compareCapabilityVersions('5.0.0', '4.0.0'), { level: 'error', reason: 'major-mismatch' })
})

test('explicit policies cover minor, patch and prerelease drift, but never downgrade a major mismatch', () => {
  for (const [policy, level] of [['warn', 'warning'], ['error', 'error']]) {
    for (const version of ['4.1.0', '4.0.1', '4.0.0-rc.1']) {
      strictEqual(compareCapabilityVersions('4.0.0', version, policy).level, level)
    }

    strictEqual(compareCapabilityVersions('4.0.0', '5.0.0-alpha.1', policy).level, 'error')
    strictEqual(compareCapabilityVersions('4.0.0+one', '4.0.0+two', policy).level, 'ok')
    strictEqual(compareCapabilityVersions('4.0.0-rc.1+one', '4.0.0-rc.1+two', policy).level, 'ok')
  }
})

test('package diagnostics retain the launcher identity across a mismatched runtime and foundation', () => {
  const reference = { name: 'wattpm', version: '4.1.0', path: '/launcher' }
  const warnings = []

  for (const name of ['@platformatic/runtime', '@platformatic/foundation']) {
    const loaded = { name, version: '4.0.0', path: `/installed/${name}` }
    checkPackageVersion(reference, loaded, { onWarning: warning => warnings.push(warning) })
    throws(() => checkPackageVersion(reference, loaded, { policy: 'error' }), {
      code: 'PLT_PACKAGE_VERSION_MISMATCH'
    })
  }

  strictEqual(warnings.length, 2)
  for (const warning of warnings) {
    strictEqual(warning.reference, reference)
    ok(warning.message.includes('/launcher'))
    ok(warning.message.includes(warning.loaded.path))
  }
})

test('a prerelease on either side demands exact identity', () => {
  // 4.0.0-alpha.1, 4.0.0-rc.2 and 4.0.0 agree on major, minor and patch while differing in schema
  // and factory shape, so the relaxed policy would pair incompatible halves precisely during the
  // period when they move fastest.
  deepStrictEqual(compareCapabilityVersions('4.0.0-rc.2', '4.0.0'), { level: 'error', reason: 'prerelease-mismatch' })
  deepStrictEqual(compareCapabilityVersions('4.0.0', '4.0.0-rc.2'), { level: 'error', reason: 'prerelease-mismatch' })
  deepStrictEqual(compareCapabilityVersions('4.0.0-alpha.1', '4.0.0-rc.2'), {
    level: 'error',
    reason: 'prerelease-mismatch'
  })
  deepStrictEqual(compareCapabilityVersions('4.0.0-rc.2', '4.0.0-rc.2'), {
    level: 'ok',
    reason: 'prerelease-identical'
  })

  // Build metadata does not affect precedence, so two copies of one prerelease that differ only in
  // a build suffix are the same version, not a skew -- semver equality, not string identity.
  deepStrictEqual(compareCapabilityVersions('4.0.0-alpha.1+build.1', '4.0.0-alpha.1+build.2'), {
    level: 'ok',
    reason: 'prerelease-identical'
  })
})

test('a hand-written definition carries no stamp and skips the check', async t => {
  const root = await createTree(t, { 'package.json': '{ "name": "app" }' })

  deepStrictEqual(compareCapabilityVersions(undefined, '4.0.0'), { level: 'ok', reason: 'unstamped' })
  strictEqual(checkCapabilityVersionSkew({ id: 'php', module: '@platformatic/php', applicationRoot: root }), null)
})

test('a skew report names both versions and the path the worker will load', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...fakePackage('@acme/capability', '4.0.0')
  })

  const skew = checkCapabilityVersionSkew({
    id: 'api',
    module: '@acme/capability',
    stamped: '5.0.0',
    applicationRoot: root
  })

  strictEqual(skew.level, 'error')
  strictEqual(skew.stamped, '5.0.0')
  strictEqual(skew.resolved, '4.0.0')
  ok(skew.message.includes('api'))
  ok(skew.message.includes(skew.resolvedPath))
})

test('a hoisted layout, where factory and worker share one copy, never false-positives', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...fakePackage('@acme/capability', '4.0.0')
  })

  strictEqual(
    checkCapabilityVersionSkew({
      id: 'api',
      module: '@acme/capability',
      stamped: '4.0.0',
      applicationRoot: root
    }),
    null
  )
})

test('root policy reaches file, object, autodetected and dynamically added applications', async t => {
  const root = await createTree(t, {
    'package.json': JSON.stringify({ name: 'api', dependencies: { '@platformatic/node': '4.0.1' } }),
    'app/package.json': JSON.stringify({ name: 'api', dependencies: { '@platformatic/node': '4.0.1' } }),
    ...fakePackage('@platformatic/node', '4.0.1', {
      type: 'module',
      exports: { '.': './index.js', './schema': './schema.js', './package.json': './package.json' }
    }),
    'node_modules/@platformatic/node/schema.js': 'export const schema = { type: "object" }',
    'watt.config.js': 'export default { versionMismatch: "warn", applications: [{ id: "api", path: "." }] }'
  })
  const versionReference = { name: 'wattpm', version: '4.0.0', path: '/launcher' }
  const warnings = []
  const shared = { versionReference, onWarning: warning => warnings.push(warning) }

  await loadConfiguration({ cwd: root, ...shared })
  strictEqual(warnings.at(-1).reason, 'patch-mismatch')

  for (const entry of [
    { id: 'api', path: 'app', config: { module: '@platformatic/node' } },
    { id: 'api', path: 'app', module: '@platformatic/node' }
  ]) {
    await rejects(loadObjectConfiguration({
      root,
      source: { versionMismatch: 'error', applications: [entry] },
      ...shared
    }), { code: 'PLT_PACKAGE_VERSION_MISMATCH' })
  }

  await rejects(loadAdditionalApplications({
    configPath: join(root, 'watt.config.js'),
    entries: [{ id: 'api', path: '.' }],
    versionMismatch: 'error',
    ...shared
  }), { code: 'PLT_PACKAGE_VERSION_MISMATCH' })

  await loadObjectConfiguration({ root, source: { applications: [{ id: 'api', path: 'app' }] }, ...shared })
})

test('the root policy also overrides factory versus implementation checks', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "api" }',
    ...fakePackage('@acme/capability', '4.0.0')
  })
  const source = {
    versionMismatch: 'warn',
    applications: [{ id: 'api', config: { module: '@acme/capability', version: '4.0.0-rc.1' } }]
  }
  const warnings = []

  await loadObjectConfiguration({ root, source, validateCapabilities: false, onWarning: warning => warnings.push(warning) })
  strictEqual(warnings.at(-1).type, 'capability-version-skew')
  strictEqual(warnings.at(-1).level, 'warning')

  await rejects(loadObjectConfiguration({
    root,
    source: { ...source, versionMismatch: 'error' },
    validateCapabilities: false
  }), { code: 'PLT_CAPABILITY_VERSION_SKEW' })
})

test('independently released Platformatic adapters skip core comparisons but retain factory checks', async t => {
  for (const module of ['@platformatic/php', '@platformatic/pg-hooks']) {
    const root = await createTree(t, {
      'package.json': JSON.stringify({ name: 'api', dependencies: { [module]: '0.8.3' } }),
      ...fakePackage(module, '0.8.3', {
        type: 'module',
        exports: { '.': './index.js', './schema': './schema.js', './package.json': './package.json' }
      }),
      [`node_modules/${module}/schema.js`]: 'export const schema = { type: "object" }'
    })
    const options = { root, versionReference: { name: 'wattpm', version: '4.0.0', path: '/launcher' } }

    for (const versionMismatch of [undefined, 'warn', 'error']) {
      for (const entry of [
        { id: 'api', path: '.' },
        { id: 'api', module },
        { id: 'api', config: { module, version: '0.8.3' } }
      ]) {
        const warnings = []
        await loadObjectConfiguration({
          ...options,
          source: { versionMismatch, applications: [entry] },
          onWarning: warning => warnings.push(warning)
        })
        strictEqual(warnings.filter(warning => warning.type === 'package-version-mismatch').length, 0)
      }
    }

    await rejects(loadObjectConfiguration({
      ...options,
      source: { versionMismatch: 'error', applications: [{ id: 'api', config: { module, version: '0.8.4' } }] }
    }), { code: 'PLT_CAPABILITY_VERSION_SKEW' })
  }
})
