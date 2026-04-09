import type { FastifyError } from '@fastify/error'
import { expect, test } from 'tstyche'
import { errors } from '../../index.js'

test('errors', () => {
  expect(errors.ObjectRequiredUnderTheDataProperty()).type.toBe<FastifyError>()
  expect(errors.PrimaryKeyIsNecessaryInsideData()).type.toBe<FastifyError>()
  expect(errors.NoSuchActionError('action')).type.toBe<FastifyError>()
})
