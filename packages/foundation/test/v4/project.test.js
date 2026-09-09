import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { projectCapabilitySchema } from '../../lib/v4/project.js'

/*
  The block is v3's way of putting orchestration inside an application's own configuration so that
  `wrapInRuntimeConfig` could hoist it. v4 has no hoisting step, so nothing reads it -- and while
  the schema admitted it, a configuration asking for `workers: 3` validated, collected defaults and
  got one worker with no diagnostic. Removing it from the projection makes that a refusal naming
  the property.
*/
test('the runtime block is not part of a v4 capability configuration', () => {
  const runtime = { type: 'object', properties: { workers: {}, logger: {} } }
  const schema = { type: 'object', properties: { runtime, module: { type: 'string' } } }

  const projected = projectCapabilitySchema(schema)

  ok(!('runtime' in projected.properties))
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
  ok('runtime' in schema.properties, 'the original still validates v3')
  strictEqual(projected.properties.module, schema.properties.module, 'untouched branches are shared')
})

test('a schema with no runtime block is returned as it is', () => {
  const schema = { type: 'object', properties: { module: { type: 'string' } } }

  strictEqual(projectCapabilitySchema(schema), schema)
})

/*
  There is no environment discovery left to opt out of. This was a pair of tests about the
  `resolved` flag -- v4 asking the v3 reader not to walk the tree for `.env` files or inject
  `PLT_ROOT`, which it did to every v4 application until the flag existed. The reader no longer
  does either for anyone, so the flag is gone and what remains is the plain fact: it reports the
  environment it was handed and invents nothing.
*/
test('the reader supplies only the environment it was given', async () => {
  const { loadConfiguration } = await import('../../lib/configuration.js')
  const { kMetadata } = await import('../../lib/symbols.js')

  const config = await loadConfiguration({ module: '@platformatic/node' }, null, {
    root: import.meta.dirname,
    env: { PLT_EXPLICIT: 'kept' }
  })

  strictEqual('PLT_ROOT' in config[kMetadata].env, false)
  strictEqual(config[kMetadata].env.PLT_EXPLICIT, 'kept')
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
