import type { ConfigurationOptions } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  NestCapability,
  type NestConfiguration,
  type NestContext,
  type PlatformaticNestJSConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  transform,
  version
} from '../../index.js'

test('Nest types', () => {
  const config = {} as PlatformaticNestJSConfig
  const configuration = {} as NestConfiguration
  const context = {} as NestContext

  expect(transform(configuration)).type.toBe<Promise<NestConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<NestConfiguration>>()
  expect(loadConfiguration(config)).type.toBe<Promise<NestConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<NestCapability>>()
  expect(create(config)).type.toBe<Promise<NestCapability>>()

  expect(transform).type.toBeCallableWith(configuration)
  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)

  expect(new NestCapability('/tmp', config)).type.toBe<NestCapability>()
  expect(new NestCapability('/tmp', config, context)).type.toBe<NestCapability>()

  expect(schema).type.toBe<JSONSchemaType<PlatformaticNestJSConfig>>()
  expect(schemaComponents).type.toBe<{ nest: JSONSchemaType<object> }>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(configuration).type.toBe<NestConfiguration>()
  expect(context).type.toBe<NestContext>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string>()
  expect(loadConfiguration('/tmp', config, {} as ConfigurationOptions)).type.toBe<Promise<NestConfiguration>>()
  expect(create('/tmp', config, {} as ConfigurationOptions)).type.toBe<Promise<NestCapability>>()
})
