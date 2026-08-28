import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { projectCapabilitySchema, projectRuntimeBlock } from '../../lib/v4/project.js'

test('the runtime block loses the keys v4 does not implement', () => {
  const block = {
    type: 'object',
    properties: {
      envfile: { type: 'string' },
      strictEnv: { type: 'boolean' },
      logger: { type: 'object' }
    }
  }

  const projected = projectRuntimeBlock(block)

  deepStrictEqual(Object.keys(projected.properties), ['logger'])
})

test('$schema stays: the loader strips it rather than refusing it', () => {
  const block = { type: 'object', properties: { $schema: { type: 'string' }, logger: {} } }

  deepStrictEqual(Object.keys(projectRuntimeBlock(block).properties), ['$schema', 'logger'])
})

/*
  The capability ships one schema and the v3 loader reads v3 configurations with it, so v4's
  narrowing cannot be an edit. Asserting the original is untouched is asserting that.
*/
test('the shipped schema is not modified', () => {
  const runtime = { type: 'object', properties: { strictEnv: { type: 'boolean' }, logger: {} } }
  const schema = { type: 'object', properties: { runtime, module: { type: 'string' } } }

  const projected = projectCapabilitySchema(schema)

  ok(projected !== schema)
  ok('strictEnv' in schema.properties.runtime.properties, 'the original still validates v3')
  ok(!('strictEnv' in projected.properties.runtime.properties))
  strictEqual(projected.properties.module, schema.properties.module, 'untouched branches are shared')
})

test('a schema with nothing to remove is returned as it is', () => {
  const schema = { type: 'object', properties: { runtime: { type: 'object', properties: { logger: {} } } } }

  strictEqual(projectCapabilitySchema(schema), schema)
})

test('a schema with no runtime block is returned as it is', () => {
  const schema = { type: 'object', properties: { module: { type: 'string' } } }

  strictEqual(projectCapabilitySchema(schema), schema)
})

/*
  `resolved` is what keeps v3's reading out of the v4 path. Nothing asserted it, and the absence
  showed: every v4 application reported `PLT_ROOT` -- a variable v4 removes -- in the environment
  `wattpm env` prints for it, because the capability re-read the tree through the v3 loader.
*/
test('a resolved configuration does not get v3 environment discovery', async () => {
  const { loadConfiguration } = await import('../../lib/configuration.js')
  const { kMetadata } = await import('../../lib/symbols.js')

  const resolved = await loadConfiguration({ module: '@platformatic/node' }, null, {
    root: import.meta.dirname,
    resolved: true,
    env: { PLT_EXPLICIT: 'kept' }
  })

  strictEqual('PLT_ROOT' in resolved[kMetadata].env, false)
  strictEqual(resolved[kMetadata].env.PLT_EXPLICIT, 'kept')
})

test('without it, the v3 reading still happens — that path still serves v3 projects', async () => {
  const { loadConfiguration } = await import('../../lib/configuration.js')
  const { kMetadata } = await import('../../lib/symbols.js')

  const legacy = await loadConfiguration({ module: '@platformatic/node' }, null, { root: import.meta.dirname })

  strictEqual(legacy[kMetadata].env.PLT_ROOT, import.meta.dirname)
})

/*
  The first hand classification of a placeholder branch. It matters more since the worker stopped
  re-validating a resolved configuration: with no coercion left to turn `'3042'` into `3042`, a
  surviving string branch does not admit a dead spelling, it admits the wrong type.
*/
test('server.port loses its placeholder string branch', () => {
  const schema = {
    type: 'object',
    properties: { server: { type: 'object', properties: { port: { anyOf: [{ type: 'integer' }, { type: 'string' }] } } } }
  }

  const projected = projectCapabilitySchema(schema)

  deepStrictEqual(projected.properties.server.properties.port, { type: 'integer' })
  // The shipped object still validates v3, where the branch is load-bearing.
  deepStrictEqual(schema.properties.server.properties.port.anyOf.length, 2)
})

test('a string branch that describes something real is left alone', () => {
  const schema = {
    type: 'object',
    properties: {
      server: {
        type: 'object',
        // A pattern says the string means something; it is not there to admit a placeholder.
        properties: { port: { anyOf: [{ type: 'integer' }, { type: 'string', pattern: '^\\d+$' }] } }
      }
    }
  }

  strictEqual(projectCapabilitySchema(schema).properties.server.properties.port.anyOf.length, 2)
})

test('every shipped capability schema loses it', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')

  for (const capability of ['node', 'service', 'db', 'gateway', 'next', 'vite']) {
    const path = join(import.meta.dirname, '../../../', capability, 'schema.json')
    const projected = projectCapabilitySchema(JSON.parse(readFileSync(path, 'utf-8')))

    deepStrictEqual(projected.properties.server?.properties?.port, { type: 'integer' }, capability)
  }
})
