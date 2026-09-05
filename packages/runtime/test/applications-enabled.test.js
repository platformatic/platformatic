import { deepStrictEqual } from 'node:assert'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'

/*
  The configuration is a program, so these fixtures are written as source rather than as JSON. The
  entries carry an inline capability so the loader has nothing to detect: an empty temporary
  directory declares no capability, and what these tests are about is `enabled`.
*/
async function writeConfig (dir, body) {
  const path = join(dir, 'watt.config.mjs')

  await writeFile(path, `export default ${body}\n`, 'utf8')

  return path
}

function application (id, extra = '') {
  return `{ id: '${id}', path: '.', config: { module: '@platformatic/node' }${extra} }`
}

function withEnv (vars, fn) {
  const prev = {}

  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key]

    if (typeof vars[key] === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = vars[key]
    }
  }

  return (async () => {
    try {
      return await fn()
    } finally {
      for (const key of Object.keys(vars)) {
        if (typeof prev[key] === 'undefined') {
          delete process.env[key]
        } else {
          process.env[key] = prev[key]
        }
      }
    }
  })()
}

test('should exclude disabled applications', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  const cfgPath = await writeConfig(
    dir,
    `{
      applications: [
        ${application('enabled')},
        ${application('disabled', ', enabled: false')}
      ]
    }`
  )

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})

test('should support environment variables for application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  /*
    A configuration reads its environment directly. v3 wrote `'{PLT_APPLICATION_ENABLED}'` and the
    loader substituted it; the string branch of `enabled` survives because the expression below
    still produces one, and anything but `'false'` is true.
  */
  const cfgPath = await writeConfig(
    dir,
    `{
      applications: [
        ${application('from-env', ", enabled: process.env.PLT_APPLICATION_ENABLED ?? 'true'")},
        ${application('always-enabled')}
      ]
    }`
  )

  await withEnv({ PLT_APPLICATION_ENABLED: 'false' }, async () => {
    const loaded = await loadConfiguration(cfgPath)
    deepStrictEqual(
      loaded.applications.map(application => application.id),
      ['always-enabled']
    )
  })

  await withEnv({ PLT_APPLICATION_ENABLED: 'true' }, async () => {
    const loaded = await loadConfiguration(cfgPath)
    deepStrictEqual(
      loaded.applications.map(application => application.id),
      ['from-env', 'always-enabled']
    )
  })
})

test('should support string values for application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  const cfgPath = await writeConfig(
    dir,
    `{
      applications: [
        ${application('enabled', ", enabled: 'true'")},
        ${application('disabled', ", enabled: 'false'")}
      ]
    }`
  )

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})

test('should support production specific application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  const cfgPath = await writeConfig(
    dir,
    `{
      applications: [
        ${application('production-disabled', ', enabled: { production: false }')},
        ${application('development-disabled', ', enabled: { development: false }')}
      ]
    }`
  )

  const loaded = await loadConfiguration(cfgPath, null, { production: true })

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['development-disabled']
  )
})

test('should support development specific application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  const cfgPath = await writeConfig(
    dir,
    `{
      applications: [
        ${application('production-disabled', ', enabled: { production: false }')},
        ${application('development-disabled', ', enabled: { development: false }')}
      ]
    }`
  )

  const loaded = await loadConfiguration(cfgPath, null, { production: false })

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['production-disabled']
  )
})

test('should enable applications when enabled configuration does not match the environment', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  const cfgPath = await writeConfig(
    dir,
    `{ applications: [${application('enabled', ', enabled: { staging: false }')}] }`
  )

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})

test('should support environment variables in application enabled environment configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))

  /*
    The per-mode form takes booleans, and the configuration computes one. v3 accepted a string
    there for the sole purpose of holding a `{PLT_X}` placeholder, and that branch is gone -- the
    top-level `enabled` keeps its string branch because anything but `'false'` is meaningfully
    true, which is not something a per-mode map needs.
  */

  const cfgPath = await writeConfig(
    dir,
    `{
      applications: [
        ${application('from-env', ", enabled: { production: process.env.PLT_APPLICATION_ENABLED !== 'false' }")},
        ${application('always-enabled')}
      ]
    }`
  )

  await withEnv({ PLT_APPLICATION_ENABLED: 'false' }, async () => {
    const loaded = await loadConfiguration(cfgPath, null, { production: true })
    deepStrictEqual(
      loaded.applications.map(application => application.id),
      ['always-enabled']
    )
  })

  await withEnv({ PLT_APPLICATION_ENABLED: 'true' }, async () => {
    const loaded = await loadConfiguration(cfgPath, null, { production: true })
    deepStrictEqual(
      loaded.applications.map(application => application.id),
      ['from-env', 'always-enabled']
    )
  })
})

test('should support disabling autoloaded applications via mappings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))
  const applicationsDir = join(dir, 'applications')

  for (const name of ['disabled', 'enabled']) {
    await mkdir(join(applicationsDir, name), { recursive: true })
    await writeFile(join(applicationsDir, name, 'index.js'), '', 'utf8')
  }

  const cfgPath = await writeConfig(
    dir,
    `{
      autoload: {
        path: 'applications',
        mappings: {
          disabled: { id: 'disabled', enabled: false }
        }
      }
    }`
  )

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})
