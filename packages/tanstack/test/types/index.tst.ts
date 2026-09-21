import type { Configuration } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  TanstackCapability,
  type PlatformaticTanStackConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  version
} from '../../index.js'

test('Tanstack types', () => {
  const config = {} as PlatformaticTanStackConfig

  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<Configuration<PlatformaticTanStackConfig>>>()
  expect(create('/tmp', config)).type.toBe<Promise<TanstackCapability>>()
  expect(create(config)).type.toBe<Promise<TanstackCapability>>()

  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)
  expect(create).type.toBeCallableWith('/tmp', config)

  expect(loadConfiguration('/tmp', config, {} as Parameters<typeof loadConfiguration>[2])).type.toBe<Promise<Configuration<PlatformaticTanStackConfig>>>()

  expect(schema).type.toBe<JSONSchemaType<PlatformaticTanStackConfig>>()
  expect(schemaComponents).type.toBe<{}>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string>()
  expect(new TanstackCapability('/tmp', config)).type.toBe<TanstackCapability>()
})
