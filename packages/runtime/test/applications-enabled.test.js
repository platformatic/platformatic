import { deepStrictEqual } from 'node:assert'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration, schema } from '../index.js'

async function writeJSON (path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
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
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [
      { id: 'enabled', path: '.' },
      { id: 'disabled', path: '.', enabled: false }
    ]
  })

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})

test('should support environment variables for application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [
      { id: 'from-env', path: '.', enabled: '{PLT_APPLICATION_ENABLED}' },
      { id: 'always-enabled', path: '.' }
    ]
  })

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
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [
      { id: 'enabled', path: '.', enabled: 'true' },
      { id: 'disabled', path: '.', enabled: 'false' }
    ]
  })

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})

test('should support production specific application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [
      { id: 'production-disabled', path: '.', enabled: { production: false } },
      { id: 'development-disabled', path: '.', enabled: { development: false } }
    ]
  })

  const loaded = await loadConfiguration(cfgPath, null, { production: true })

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['development-disabled']
  )
})

test('should support development specific application enabled configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [
      { id: 'production-disabled', path: '.', enabled: { production: false } },
      { id: 'development-disabled', path: '.', enabled: { development: false } }
    ]
  })

  const loaded = await loadConfiguration(cfgPath, null, { production: false })

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['production-disabled']
  )
})

test('should enable applications when enabled configuration does not match the environment', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [{ id: 'enabled', path: '.', enabled: { staging: false } }]
  })

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})

test('should support environment variables in application enabled environment configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-applications-enabled-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    applications: [
      { id: 'from-env', path: '.', enabled: { production: '{PLT_APPLICATION_ENABLED}' } },
      { id: 'always-enabled', path: '.' }
    ]
  })

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
  const cfgPath = join(dir, 'platformatic.runtime.json')

  await mkdir(join(applicationsDir, 'disabled'), { recursive: true })
  await mkdir(join(applicationsDir, 'enabled'), { recursive: true })

  await writeJSON(cfgPath, {
    $schema: schema.$id,
    autoload: {
      path: 'applications',
      mappings: {
        disabled: { id: 'disabled', enabled: false }
      }
    }
  })

  const loaded = await loadConfiguration(cfgPath)

  deepStrictEqual(
    loaded.applications.map(application => application.id),
    ['enabled']
  )
})
