import { getGlobal, removeGlobals, updateGlobals } from '@platformatic/globals'
import { ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { version } from '../lib/version.js'

const fixture = join(import.meta.dirname, '..', 'fixtures', 'v4-monorepo')

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
    code: 'PLT_PACKAGE_VERSION_MISMATCH'
  })

  // Major differences remain fatal even when the main configuration requests warnings.
  updateGlobals({ cliPackage: { name: 'wattpm', version: '999.0.0', path: '/npx/wattpm' } })
  await rejects(loadConfiguration(fixture, source), { code: 'PLT_PACKAGE_VERSION_MISMATCH' })
})

test('the main configuration rejects unknown version mismatch policies', async () => {
  await rejects(loadConfiguration(fixture, {
    versionMismatch: 'ignore',
    applications: [{ id: 'api', path: 'web/api' }]
  }), /versionMismatch/)
})
