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

/*
  The health block is the case for reading consumers rather than shapes. Six of its properties are
  `number | string` with the string branch looking identical in every one; five of them mean `'1 GB'`
  and the sixth is a ratio that could never have been a size.
*/
test('the health block keeps the sizes and loses the numbers', () => {
  const health = {
    type: 'object',
    properties: {
      interval: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }], default: 30000 },
      maxHeapUsed: { anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'string' }], default: 0.99 },
      maxHeapTotal: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }], default: 4294967296 },
      bufferPoolSize: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string' }], default: 262144 }
    }
  }

  const { properties } = projectCapabilitySchema({ type: 'object', properties: { health } }).properties.health

  // Compared and arithmetic'd, never parsed.
  strictEqual(properties.interval.anyOf, undefined)
  strictEqual(properties.maxHeapUsed.anyOf, undefined)
  strictEqual(properties.maxHeapUsed.maximum, 1)

  // Passed to parseMemorySize, so the string is a value they mean.
  strictEqual(properties.maxHeapTotal.anyOf.length, 2)
  strictEqual(properties.bufferPoolSize.anyOf.length, 2)
})

/*
  Positions are matched by `parent/property`, not by name. `health.interval` is on the list and any
  other `interval` is not -- which is the distinction the audit cannot draw, and the reason two
  properties called `enabled` were reported as one candidate.
*/
test('a property of the same name elsewhere is untouched', () => {
  const union = { anyOf: [{ type: 'number' }, { type: 'string' }] }
  const schema = {
    type: 'object',
    properties: {
      health: { type: 'object', properties: { interval: { ...union } } },
      scheduler: { type: 'object', properties: { interval: { ...union } } }
    }
  }

  const projected = projectCapabilitySchema(schema)

  strictEqual(projected.properties.health.properties.interval.anyOf, undefined)
  strictEqual(projected.properties.scheduler.properties.interval.anyOf.length, 2)
})

test('a schema with nothing on the list is returned as it is', () => {
  const schema = { type: 'object', properties: { scheduler: { type: 'object', properties: { cron: { type: 'string' } } } } }

  strictEqual(projectCapabilitySchema(schema), schema)
})
