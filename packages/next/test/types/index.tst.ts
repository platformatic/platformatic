import type { JSONSchemaType } from 'ajv'
import type { FastifyError } from 'fastify'
import { expect, test } from 'tstyche'
import {
  NextCapability,
  NextImageOptimizerCapability,
  type NextConfiguration,
  type NextContext,
  type PlatformaticNextJsConfig,
  create,
  enhanceNextConfig,
  getAdapterPath,
  getCacheHandlerPath,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  transform,
  version,
  errors
} from '../../index.js'

test('Next types', () => {
  const config = {} as PlatformaticNextJsConfig
  const configuration = {} as NextConfiguration
  const context = {} as NextContext

  expect(transform(configuration)).type.toBe<Promise<NextConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<NextConfiguration>>()
  expect(loadConfiguration(config)).type.toBe<Promise<NextConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<NextCapability | NextImageOptimizerCapability>>()
  expect(create(config)).type.toBe<Promise<NextCapability | NextImageOptimizerCapability>>()

  expect(transform).type.toBeCallableWith(configuration)
  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)

  expect(new NextCapability('/tmp', config)).type.toBe<NextCapability>()
  expect(new NextImageOptimizerCapability('/tmp', config)).type.toBe<NextImageOptimizerCapability>()
  expect(new NextImageOptimizerCapability('/tmp', config, context)).type.toBe<NextImageOptimizerCapability>()

  expect(enhanceNextConfig({})).type.toBe<Promise<any>>()
  expect(getAdapterPath()).type.toBe<string>()
  expect(getCacheHandlerPath('isr')).type.toBe<string>()

  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string[]>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticNextJsConfig>>()
  expect(schemaComponents).type.toBe<{ next: JSONSchemaType<object> }>()
  expect(errors.StandaloneServerNotFound()).type.toBe<FastifyError>()
  expect(errors.CannotParseStandaloneServer()).type.toBe<FastifyError>()
  expect(context).type.toBe<NextContext>()
})
