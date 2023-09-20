import { expectType } from 'tsd'
import { FastifyError } from '@fastify/error'
import {
  errors
} from '../../index'

// Errors
type ErrorWithNoParams = () => FastifyError
type ErrorWithOneParam = (param: string) => FastifyError

expectType<ErrorWithNoParams>(errors.UnableToGenerateGraphQLEnumTypeError)
expectType<ErrorWithOneParam>(errors.UnsupportedKindError)
expectType<ErrorWithNoParams>(errors.ErrorPrintingGraphQLSchema)


