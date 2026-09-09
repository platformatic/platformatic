import type { JSONSchemaType } from 'ajv'
import type { FastifyError } from 'fastify'
import type { ApplicationDefinition, ConfigContext, DeferredApplicationDefinition } from '@platformatic/basic'
import type { ConfigurationOptions } from '@platformatic/foundation'
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
  next,
  type NextConfigOptions,
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
  expect(transform).type.toBeCallableWith(configuration, {} as object)
  expect(transform).type.toBeCallableWith(configuration, {} as object, {} as ConfigurationOptions)
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

test('Next factory', () => {
  expect(next({ trailingSlash: true })).type.toBe<ApplicationDefinition>()

  /*
    The callback form returns a function the loader awaits, so reading a property of the definition
    on it is a type error until it has run. A single signature returning ApplicationDefinition for
    both forms would typecheck this, which is the mistake the deferred type exists to prevent.
  */
  expect(next(() => ({ trailingSlash: true }))).type.toBe<DeferredApplicationDefinition>()
  expect(next(async () => ({ trailingSlash: true }))).type.toBe<DeferredApplicationDefinition>()
  expect(next(() => ({ trailingSlash: true }))).type.not.toHaveProperty('module')

  // The capability's own block is flattened into the top level; the shared blocks keep their
  // v3 positions.
  expect<NextConfigOptions>().type.toHaveProperty('trailingSlash')
  expect<NextConfigOptions>().type.toHaveProperty('server')
  expect<NextConfigOptions>().type.not.toHaveProperty('$schema')
  expect<NextConfigOptions>().type.not.toHaveProperty('module')

  // The context a deferred definition is evaluated against.
  expect(next((context: ConfigContext) => ({ trailingSlash: context.production }))).type.toBe<
    DeferredApplicationDefinition
  >()
})
