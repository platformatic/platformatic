import type { FastifyError } from '@fastify/error'
import { expect, test } from 'tstyche'
import { errors } from '../../index.js'

test('errors', () => {
  expect(errors.UnableToGenerateGraphQLEnumTypeError()).type.toBe<FastifyError>()
  expect(errors.UnsupportedKindError('kind')).type.toBe<FastifyError>()
  expect(errors.ErrorPrintingGraphQLSchema()).type.toBe<FastifyError>()
})
