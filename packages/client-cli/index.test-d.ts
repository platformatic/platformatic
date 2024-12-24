import { expectError, expectType } from 'tsd'
import { command, errors } from '.'
import { FastifyError } from '@fastify/error'

// command
expectType<Promise<void>>(command([]))
expectType<Promise<void>>(command(['foo', 'bar']))
expectError<Promise<void>>(command(false))
expectError<Promise<void>>(command([4, 2]))

// errors
expectType<FastifyError>(errors.TypeNotSupportedError('someType'))
expectType<FastifyError>(errors.UnknownTypeError('otherType'))
expectError<FastifyError>(errors.TypeNotSupportedError())
expectError<FastifyError>(errors.UnknownTypeError())
