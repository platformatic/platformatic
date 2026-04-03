import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  ReactRouterCapability,
  type ReactRouterConfiguration,
  type ReactRouterContext,
  type PlatformaticReactRouterConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  transform,
  version
} from '../../index.js'

test('React Router types', () => {
  const config = {} as PlatformaticReactRouterConfig
  const configuration = {} as ReactRouterConfiguration
  const context = {} as ReactRouterContext

  expect(transform(configuration)).type.toBe<Promise<ReactRouterConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<ReactRouterConfiguration>>()
  expect(loadConfiguration(config)).type.toBe<Promise<ReactRouterConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<ReactRouterCapability>>()

  expect(transform).type.toBeCallableWith(configuration)
  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)

  expect(new ReactRouterCapability('/tmp', config)).type.toBe<ReactRouterCapability>()
  expect(new ReactRouterCapability('/tmp', config, context)).type.toBe<ReactRouterCapability>()

  expect(configuration).type.toBe<ReactRouterConfiguration>()
  expect(context).type.toBe<ReactRouterContext>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticReactRouterConfig>>()
  expect(schemaComponents).type.toBe<{ reactRouter: JSONSchemaType<object> }>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string>()
})
