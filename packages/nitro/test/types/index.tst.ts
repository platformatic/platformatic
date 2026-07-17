import type { Configuration } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  NitroCapability,
  NitroViteCapability,
  type PlatformaticNitroConfig,
  type ResolvedNitroPackage,
  create,
  hasViteConfigFile,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  resolveNitroPackage,
  supportedVersions,
  version
} from '../../index.js'

test('Nitro public types', () => {
  const config = {} as PlatformaticNitroConfig

  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<Configuration<PlatformaticNitroConfig>>>()
  expect(create('/tmp', config)).type.toBe<Promise<NitroCapability | NitroViteCapability>>()
  expect(create(config)).type.toBe<Promise<NitroCapability | NitroViteCapability>>()
  expect(hasViteConfigFile('/tmp', config)).type.toBe<boolean>()
  expect(resolveNitroPackage('/tmp')).type.toBe<Promise<ResolvedNitroPackage>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticNitroConfig>>()
  expect(schemaComponents).type.toBe<{ nitro: JSONSchemaType<object> }>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<{ nitro: string, nitropack: string }>()
  expect(new NitroCapability('/tmp', config)).type.toBe<NitroCapability>()
  expect(new NitroViteCapability('/tmp', config)).type.toBe<NitroViteCapability>()
})
