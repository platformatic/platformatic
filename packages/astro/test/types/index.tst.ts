import type { JSONSchemaType } from 'ajv'
import type { ConfigurationOptions } from '@platformatic/foundation'
import { expect, test } from 'tstyche'
import {
  AstroCapability,
  type AstroConfiguration,
  type AstroContext,
  type PlatformaticAstroConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  transform,
  version
} from '../../index.js'

test('Astro types', () => {
  const config = {} as PlatformaticAstroConfig
  const configuration = {} as AstroConfiguration
  const context = {} as AstroContext

  expect(transform(configuration)).type.toBe<Promise<AstroConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<AstroConfiguration>>()
  expect(loadConfiguration(config)).type.toBe<Promise<AstroConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<AstroCapability>>()
  expect(create(config)).type.toBe<Promise<AstroCapability>>()

  expect(transform).type.toBeCallableWith(configuration)
  expect(transform).type.toBeCallableWith(configuration, {} as object)
  expect(transform).type.toBeCallableWith(configuration, {} as object, {} as ConfigurationOptions)
  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)
  expect(create).type.toBeCallableWith('/tmp', config)

  expect(new AstroCapability('/tmp', config)).type.toBe<AstroCapability>()
  expect(new AstroCapability('/tmp', config, context)).type.toBe<AstroCapability>()

  expect(configuration).type.toBe<AstroConfiguration>()

  expect(context).type.toBe<AstroContext>()

  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticAstroConfig>>()
  expect(schemaComponents).type.toBe<{ astro: JSONSchemaType<object> }>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string>()
})
