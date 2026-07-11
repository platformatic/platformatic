import type { Configuration } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  NitroCapability,
  NitroViteCapability,
  type PlatformaticNitroConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  version
} from '../../index.js'

test('Nitro types', () => {
  const config = {} as PlatformaticNitroConfig

  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<Configuration<PlatformaticNitroConfig>>>()
  expect(create('/tmp', config)).type.toBe<Promise<NitroCapability | NitroViteCapability>>()
  expect(create(config)).type.toBe<Promise<NitroCapability | NitroViteCapability>>()

  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)
  expect(create).type.toBeCallableWith('/tmp', config)

  expect(loadConfiguration('/tmp', config, {} as Parameters<typeof loadConfiguration>[2])).type.toBe<Promise<Configuration<PlatformaticNitroConfig>>>()

  expect(schema).type.toBe<JSONSchemaType<PlatformaticNitroConfig>>()
  expect(schemaComponents).type.toBe<{ nitro: unknown }>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<{ nitro: string, nitropack: string }>()
  expect(new NitroCapability('/tmp', config)).type.toBe<NitroCapability>()
  expect(new NitroViteCapability('/tmp', config)).type.toBe<NitroViteCapability>()
})
