import { getGlobal, removeGlobals, updateGlobals } from '@platformatic/globals'
import { ok, rejects, strictEqual } from 'node:assert'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { loadConfiguration } from '../index.js'
import { version } from '../lib/version.js'
import { comparePackageVersions } from '../lib/version-mismatch.js'
import { versionCases } from '@platformatic/foundation/test/loader/version-cases.js'
import { createTree } from '@platformatic/foundation/test/loader/helper.js'

const fixture = join(import.meta.dirname, '..', 'fixtures', 'v4-monorepo')

test('runtime bootstrap follows the shared version policy in both directions', () => {
  for (const [left, right, expected] of versionCases) {
    for (const [index, policy] of [undefined, 'warn', 'error'].entries()) {
      strictEqual(comparePackageVersions(left, right, policy), expected[index])
      strictEqual(comparePackageVersions(right, left, policy), expected[index])
    }
  }
})

test('the launcher version governs runtime, foundation and unstamped capabilities', async t => {
  const previous = getGlobal()?.cliPackage
  updateGlobals({ cliPackage: { name: 'wattpm', version: `${version.split('.')[0]}.99.0`, path: '/npx/wattpm' } })
  t.after(() => {
    if (previous) {
      updateGlobals({ cliPackage: previous })
    } else {
      removeGlobals(['cliPackage'])
    }
  })

  const source = {
    versionMismatch: 'warn',
    applications: [{ id: 'api', path: 'web/api' }]
  }
  const warnings = []
  const context = { logger: { warn: message => warnings.push(message), info () {} } }
  await loadConfiguration(fixture, source, context)

  for (const name of ['@platformatic/runtime', '@platformatic/foundation', '@platformatic/node']) {
    ok(warnings.some(message => message.includes(`matching ${name}`)), name)
  }
  strictEqual(warnings.filter(message => message.includes('matching')).length, 3)
  ok(warnings.every(message => message.includes('/npx/wattpm')))

  await rejects(loadConfiguration(fixture, { ...source, versionMismatch: 'error' }), {
    code: 'PLT_RUNTIME_PACKAGE_VERSION_MISMATCH'
  })

  // Major differences remain fatal even when the main configuration requests warnings.
  updateGlobals({ cliPackage: { name: 'wattpm', version: '999.0.0', path: '/npx/wattpm' } })
  await rejects(loadConfiguration(fixture, source), { code: 'PLT_RUNTIME_PACKAGE_VERSION_MISMATCH' })
})

test('the main configuration rejects unknown version mismatch policies', async () => {
  await rejects(loadConfiguration(fixture, {
    versionMismatch: 'ignore',
    applications: [{ id: 'api', path: 'web/api' }]
  }), /versionMismatch/)
})

test('an older foundation without the new checker export still reaches the runtime policy', async t => {
  const root = await createTree(t, {
    'foundation.json': JSON.stringify({ name: '@platformatic/foundation', version: '4.0.0-older' })
  })
  const loaderURL = import.meta.resolve('@platformatic/foundation/loader')
  const runtimeURL = new URL('../index.js', import.meta.url).href
  const manifestURL = pathToFileURL(join(root, 'foundation.json')).href

  // Isolate module hooks in a subprocess: emulate the previous public loader API and manifest
  // without changing installed packages or interfering with other tests' module caches.
  const script = `
    import { registerHooks } from 'node:module'
    import { ok, rejects, strictEqual } from 'node:assert'
    registerHooks({
      resolve (specifier, context, nextResolve) {
        if (specifier === '@platformatic/foundation/package.json') {
          return { url: ${JSON.stringify(manifestURL)}, shortCircuit: true }
        }
        return nextResolve(specifier, context)
      },
      load (url, context, nextLoad) {
        const loaded = nextLoad(url, context)
        if (url === ${JSON.stringify(loaderURL)}) {
          return { ...loaded, source: String(loaded.source).replace(
            "export * from './capability-resolution.js'",
            "export { resolveCapabilityPackage, compareCapabilityVersions, checkCapabilityVersionSkew } from './capability-resolution.js'"
          ) }
        }
        return loaded
      }
    })
    const foundation = await import(${JSON.stringify(loaderURL)})
    strictEqual('checkPackageVersion' in foundation, false)
    const { loadConfiguration } = await import(${JSON.stringify(runtimeURL)})
    const source = { versionMismatch: 'warn', applications: [{ id: 'api', path: 'web/api' }] }
    const warnings = []
    await loadConfiguration(${JSON.stringify(fixture)}, source, {
      logger: { warn: message => warnings.push(message), info () {} }
    })
    strictEqual(warnings.length, 1)
    ok(warnings[0].includes('@platformatic/foundation'))
    ok(warnings[0].includes('4.0.0-older'))
    await rejects(loadConfiguration(${JSON.stringify(fixture)}, { ...source, versionMismatch: 'error' }), {
      code: 'PLT_RUNTIME_PACKAGE_VERSION_MISMATCH'
    })
    const { versionMismatch, ...defaults } = source
    await rejects(loadConfiguration(${JSON.stringify(fixture)}, defaults), {
      code: 'PLT_RUNTIME_PACKAGE_VERSION_MISMATCH'
    })
  `
  await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', script])
})
