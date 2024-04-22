import { expectError, expectType } from 'tsd'
import { command, errors } from '.'
import { FastifyError } from 'fastify'

// command
expectType<void>(await command([]))
expectType<void>(await command(['foo', 'bar']))
expectError<void>(await command(false))
expectError<void>(await command([4, 2]))

// errors
expectType<FastifyError>(errors.TypeNotSupportedError('someType'))
expectType<FastifyError>(errors.UnknownTypeError('otherType'))
expectError<FastifyError>(errors.TypeNotSupportedError())
expectError<FastifyError>(errors.UnknownTypeError())