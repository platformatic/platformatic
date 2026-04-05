import type { FastifyError } from '@fastify/error'
import { expect, test } from 'tstyche'
import { errors } from '../../index.js'

test('errors', () => {
  expect(errors.RuntimeExitedError()).type.toBe<FastifyError>()
  expect(errors.UnknownRuntimeAPICommandError('command')).type.toBe<FastifyError>()
  expect(errors.ApplicationNotFoundError('id')).type.toBe<FastifyError>()
  expect(errors.ApplicationNotStartedError('id')).type.toBe<FastifyError>()
  expect(errors.FailedToRetrieveOpenAPISchemaError('id', 'error')).type.toBe<FastifyError>()
  expect(errors.ApplicationAlreadyStartedError()).type.toBe<FastifyError>()
  expect(errors.RuntimeNotStartedError()).type.toBe<FastifyError>()
  expect(errors.ConfigPathMustBeStringError()).type.toBe<FastifyError>()
  expect(errors.NoConfigFileFoundError('id')).type.toBe<FastifyError>()
  expect(errors.InvalidEntrypointError('entrypoint')).type.toBe<FastifyError>()
  expect(errors.MissingEntrypointError()).type.toBe<FastifyError>()
  expect(errors.MissingDependencyError('dependency')).type.toBe<FastifyError>()
  expect(errors.InspectAndInspectBrkError()).type.toBe<FastifyError>()
  expect(errors.InspectorPortError()).type.toBe<FastifyError>()
  expect(errors.InspectorHostError()).type.toBe<FastifyError>()
  expect(errors.CannotMapSpecifierToAbsolutePathError('specifier')).type.toBe<FastifyError>()
  expect(errors.NodeInspectorFlagsNotSupportedError()).type.toBe<FastifyError>()
})
