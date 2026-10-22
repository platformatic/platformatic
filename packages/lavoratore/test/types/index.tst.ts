import type { Configuration } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  LavoratoreCapability,
  type PlatformaticLavoratoreConfig,
  create,
  loadConfiguration,
  loadWranglerConfig,
  packageJson,
  schema,
  schemaComponents,
  version
} from '../../index.js'
import { WorkerEntrypoint, env } from '../../lib/shims/workers.js'

test('Lavoratore public types', () => {
  const config = {} as PlatformaticLavoratoreConfig

  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<Configuration<PlatformaticLavoratoreConfig>>>()
  expect(create('/tmp', config)).type.toBe<Promise<LavoratoreCapability>>()
  expect(loadWranglerConfig('/tmp')).type.toBe<Promise<{ path: string | null, config: Record<string, unknown> }>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticLavoratoreConfig>>()
  expect(schemaComponents).type.toBe<{ lavoratore: JSONSchemaType<object> }>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(version).type.toBe<string>()
  expect(new LavoratoreCapability('/tmp', config)).type.toBe<LavoratoreCapability>()
  expect(env).type.toBe<Record<string, unknown>>()
  expect(WorkerEntrypoint).type.toBeConstructableWith({ props: {}, waitUntil () {}, passThroughOnException () {} }, {})
})
