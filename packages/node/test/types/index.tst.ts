import type { Configuration } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  Generator,
  NodeCapability,
  type NodeConfiguration,
  type NodeContext,
  type PlatformaticNodeJsConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  transform,
  version
} from '../../index.js'

test('Node types', () => {
  const config = {} as PlatformaticNodeJsConfig
  const configuration = {} as NodeConfiguration
  const context = {} as NodeContext

  expect(transform(configuration)).type.toBe<Promise<NodeConfiguration>>()
  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<NodeConfiguration>>()
  expect(loadConfiguration(config)).type.toBe<Promise<NodeConfiguration>>()
  expect(create('/tmp', config)).type.toBe<Promise<NodeCapability>>()

  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)
  expect(create).type.toBeCallableWith('/tmp', config)

  expect(new NodeCapability('/tmp', config)).type.toBe<NodeCapability>()
  expect(new NodeCapability('/tmp', config, context)).type.toBe<NodeCapability>()
  expect(new Generator()).type.toBe<Generator>()

  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticNodeJsConfig>>()
  expect(schemaComponents).type.toBe<{ node: JSONSchemaType<object> }>()
  expect(version).type.toBe<string>()
  expect(context).type.toBe<NodeContext>()
  expect(configuration).type.toBe<NodeConfiguration>()
  expect(loadConfiguration('/tmp', config, {} as Parameters<typeof loadConfiguration>[2])).type.toBe<Promise<NodeConfiguration>>()
})
