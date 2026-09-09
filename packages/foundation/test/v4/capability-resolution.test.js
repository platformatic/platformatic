import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  checkCapabilityVersionSkew,
  compareCapabilityVersions,
  resolveCapabilityPackage
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

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
  // Inverting v3 is what makes the stamp check implementable: it compares the factory's copy
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
