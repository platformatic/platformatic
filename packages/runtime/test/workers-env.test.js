'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { loadConfig } = require('@platformatic/config')
const { platformaticRuntime } = require('../lib/config')

async function writeJSON (path, data) {
  const content = JSON.stringify(data, null, 2)
  await writeFile(path, content, 'utf8')
}

function withEnv (vars, fn) {
  const prev = {}
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k]
    if (vars[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = vars[k]
    }
  }
  return (async () => {
    try {
      return await fn()
    } finally {
      for (const k of Object.keys(vars)) {
        if (prev[k] === undefined) delete process.env[k]
        else process.env[k] = prev[k]
      }
    }
  })()
}

test('root workers: missing PLT_WORKERS fails fast', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')
  await writeJSON(cfgPath, {
    $schema: platformaticRuntime.schema.$id,
    workers: '{PLT_WORKERS}',
    entrypoint: 'svc',
    services: [
      { id: 'svc', path: '.' }
    ]
  })

  await withEnv({ PLT_WORKERS: undefined }, async () => {
    await assert.rejects(async () => {
      await loadConfig({}, ['-c', cfgPath], platformaticRuntime)
    }, (err) => {
      // Either our custom error or schema validation (AJV) kicks in first
      return /Runtime workers must be a positive integer/.test(err?.message || '') || err?.code === 'PLT_CONFIG_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA'
    })
  })
})

test('root workers: invalid PLT_WORKERS fails fast', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')
  await writeJSON(cfgPath, {
    $schema: platformaticRuntime.schema.$id,
    workers: '{PLT_WORKERS}',
    entrypoint: 'svc',
    services: [
      { id: 'svc', path: '.' }
    ]
  })

  await withEnv({ PLT_WORKERS: 'foobar' }, async () => {
    await assert.rejects(async () => {
      await loadConfig({}, ['-c', cfgPath], platformaticRuntime)
    }, (err) => {
      return /Runtime workers must be a positive integer/.test(err?.message || '') || err?.code === 'PLT_CONFIG_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA'
    })
  })
})

test('root workers: valid PLT_WORKERS coerces to number', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')
  await writeJSON(cfgPath, {
    $schema: platformaticRuntime.schema.$id,
    workers: '{PLT_WORKERS}',
    entrypoint: 'svc',
    services: [
      { id: 'svc', path: '.' }
    ]
  })

  await withEnv({ PLT_WORKERS: '2' }, async () => {
    const loaded = await loadConfig({}, ['-c', cfgPath], platformaticRuntime)
    assert.strictEqual(loaded.configManager.current.workers, 2)
  })
})

test('service workers: missing PLT_WORKERS fails fast with service context', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')
  await writeJSON(cfgPath, {
    $schema: platformaticRuntime.schema.$id,
    entrypoint: 'svc',
    services: [
      {
        id: 'svc',
        path: '.',
        workers: '{PLT_WORKERS}'
      }
    ]
  })

  await withEnv({ PLT_WORKERS: undefined }, async () => {
    await assert.rejects(
      () => loadConfig({}, ['-c', cfgPath], platformaticRuntime),
      /Service "svc" workers must be a positive integer/
    )
  })
})

test('service workers: valid PLT_WORKERS coerces to number', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = join(dir, 'platformatic.runtime.json')
  await writeJSON(cfgPath, {
    $schema: platformaticRuntime.schema.$id,
    entrypoint: 'svc',
    services: [
      {
        id: 'svc',
        path: '.',
        workers: '{PLT_WORKERS}'
      }
    ]
  })

  await withEnv({ PLT_WORKERS: '3' }, async () => {
    const loaded = await loadConfig({}, ['-c', cfgPath], platformaticRuntime)
    const svc = loaded.configManager.current.services.find(s => s.id === 'svc')
    assert.strictEqual(svc.workers, 3)
  })
})
