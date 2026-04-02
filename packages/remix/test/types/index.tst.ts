import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  RemixCapability,
  type PlatformaticRemixConfig,
  type RemixConfiguration,
  type RemixContext,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  transform,
  version
} from '../../index.js'

test('Remix types', () => {
  const config = {} as PlatformaticRemixConfig
  const configuration = {} as RemixConfiguration
  const context = {} as RemixContext

  expect(transform(configuration)).type.toBe<Promise<RemixConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<RemixConfiguration>>()
  expect(loadConfiguration(config)).type.toBe<Promise<RemixConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<RemixCapability>>()

  expect(transform).type.toBeCallableWith(configuration)
  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)

  expect(new RemixCapability('/tmp', config)).type.toBe<RemixCapability>()
  expect(new RemixCapability('/tmp', config, context)).type.toBe<RemixCapability>()

  expect(configuration).type.toBe<RemixConfiguration>()
  expect(context).type.toBe<RemixContext>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticRemixConfig>>()
  expect(schemaComponents).type.toBe<{ remix: JSONSchemaType<object> }>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string>()
})
