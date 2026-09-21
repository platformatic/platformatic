import type { Configuration } from '@platformatic/foundation'
import type { BaseCapability } from '@platformatic/basic'
import type { FastifyError, FastifyInstance } from 'fastify'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import {
  type GatewayCommand,
  type GatewayCommandDefinition,
  type GatewayCapability,
  type PlatformaticGatewayConfig,
  type ServerInstance,
  create,
  createCommands,
  errors,
  loadConfiguration,
  packageJson,
  platformaticGateway,
  schema,
  schemaComponents,
  skipTelemetryHooks
} from '../../index.js'

test('Gateway types', () => {
  const config = {} as PlatformaticGatewayConfig
  const serverInstance = {} as ServerInstance
  const command: GatewayCommand = { usage: 'start', description: 'start gateway' }
  const commandDefinition: GatewayCommandDefinition = { commands: {}, help: {} }

  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<Configuration<PlatformaticGatewayConfig>>>()
  expect(create('/tmp', config)).type.toBe<Promise<GatewayCapability>>()

  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)
  expect(create).type.toBeCallableWith('/tmp', config)

  expect(createCommands('gateway-id')).type.toBe<GatewayCommandDefinition>()

  expect(createCommands).type.toBeCallableWith('gateway-id')
  expect(createCommands('gateway-id').commands).type.toBe<Record<string, (...args: unknown[]) => Promise<void> | void>>()
  expect(command).type.toBe<GatewayCommand>()
  expect(commandDefinition).type.toBe<GatewayCommandDefinition>()

  expect(serverInstance).type.toBe<ServerInstance>()

  expect(skipTelemetryHooks).type.toBe<boolean>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(schema).type.toBe<JSONSchemaType<PlatformaticGatewayConfig>>()
  expect(schemaComponents).type.toBe<{
    openApiApplication: JSONSchemaType<object>
    entityResolver: JSONSchemaType<object>
    entities: JSONSchemaType<object>
    graphqlApplication: JSONSchemaType<object>
    graphqlComposerOptions: JSONSchemaType<object>
    gateway: JSONSchemaType<object>
    types: JSONSchemaType<object>
  }>()
  expect(platformaticGateway({} as FastifyInstance, {} as BaseCapability)).type.toBe<Promise<void>>()
  expect(errors.FastifyInstanceIsAlreadyListeningError()).type.toBe<FastifyError>()
  expect(errors.FailedToFetchOpenAPISchemaError()).type.toBe<FastifyError>()
  expect(errors.ValidationErrors()).type.toBe<FastifyError>()
  expect(errors.PathAlreadyExistsError()).type.toBe<FastifyError>()
  expect(errors.CouldNotReadOpenAPIConfigError()).type.toBe<FastifyError>()
})
