import type { FastifyError } from '@fastify/error'
import { expect, test } from 'tstyche'
import { errors } from '../../index.js'

test('errors', () => {
  expect(errors.UnableToCreateTheRouteForTheReverseRelationshipError()).type.toBe<FastifyError>()
  expect(errors.UnableToCreateTheRouteForThePKColRelationshipError()).type.toBe<FastifyError>()
  expect(errors.UnableToParseCursorStrError()).type.toBe<FastifyError>()
  expect(errors.CursorValidationError()).type.toBe<FastifyError>()
  expect(errors.PrimaryKeyNotIncludedInOrderByInCursorPaginationError()).type.toBe<FastifyError>()
})
