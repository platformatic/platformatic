import { deepStrictEqual, rejects } from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'

/*
  v3 wrote `workers: '{PLT_WORKERS}'` and interpolated; v4's configuration file reads the
  environment itself, and `workers` still admits the string that read produces because
  `coercePositiveInteger` parses it on the way in, raising a named error when it will not convert.
  The `?? ''` mirrors v3's fail-closed-to-empty for an unset variable, which is what makes the
  missing-variable case an error rather than a silent default.
*/
async function writeRootConfig (dir, workersExpression) {
  const path = join(dir, 'watt.config.mjs')
  await writeFile(
    path,
    `export default {\n  workers: ${workersExpression},\n  applications: [{ id: 'svc', path: '.' }]\n}\n`,
    'utf8'
  )
  return path
}

async function writeEntryConfig (dir, workersExpression) {
  const path = join(dir, 'watt.config.mjs')
  await writeFile(
    path,
    `export default {\n  applications: [{ id: 'svc', path: '.', workers: ${workersExpression} }]\n}\n`,
    'utf8'
  )
  return path
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
  const cfgPath = await writeRootConfig(dir, "process.env.PLT_WORKERS ?? ''")

  await withEnv({ PLT_WORKERS: undefined }, async () => {
    await rejects(() => loadConfiguration(cfgPath), /Runtime workers must be a positive integer/)
  })
})

test('root workers: invalid PLT_WORKERS fails fast', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = await writeRootConfig(dir, "process.env.PLT_WORKERS ?? ''")

  await withEnv({ PLT_WORKERS: 'foobar' }, async () => {
    await rejects(() => loadConfiguration(cfgPath), /Runtime workers must be a positive integer/)
  })
})

test('root workers: valid PLT_WORKERS coerces to number', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = await writeRootConfig(dir, "process.env.PLT_WORKERS ?? ''")

  await withEnv({ PLT_WORKERS: '2' }, async () => {
    const loaded = await loadConfiguration(cfgPath)
    deepStrictEqual(loaded.workers, { dynamic: false, static: 2 })
  })
})

test('service workers: missing PLT_WORKERS fails fast with service context', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = await writeEntryConfig(dir, "process.env.PLT_WORKERS ?? ''")

  await withEnv({ PLT_WORKERS: undefined }, async () => {
    await rejects(() => loadConfiguration(cfgPath), /Service "svc" workers must be a positive integer/)
  })
})

test('service workers: valid PLT_WORKERS coerces to number', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-workers-'))
  const cfgPath = await writeEntryConfig(dir, "process.env.PLT_WORKERS ?? ''")

  await withEnv({ PLT_WORKERS: '3' }, async () => {
    const loaded = await loadConfiguration(cfgPath)
    const svc = loaded.applications.find(s => s.id === 'svc')
    deepStrictEqual(svc.workers, { dynamic: false, static: 3 })
  })
})
