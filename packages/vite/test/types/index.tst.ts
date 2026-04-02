import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  type PlatformaticViteConfig,
  type ViteConfiguration,
  type ViteContext,
  type ViteCapability,
  type ViteSSRCapability,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  transform,
  version
} from '../../index.js'

test('Vite types', () => {
  const config = {} as PlatformaticViteConfig
  const configuration = {} as ViteConfiguration
  const context = {} as ViteContext

  expect(transform(configuration)).type.toBe<Promise<ViteConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<ViteConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<ViteCapability | ViteSSRCapability>>()
  expect(create(config)).type.toBe<Promise<ViteCapability | ViteSSRCapability>>()

  expect(create).type.toBeCallableWith('/tmp', config)
  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)

  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticViteConfig>>()
  expect(schemaComponents).type.toBe<{ vite: JSONSchemaType<object> }>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string[]>()
  expect(configuration).type.toBe<ViteConfiguration>()
  expect(context).type.toBe<ViteContext>()
})
