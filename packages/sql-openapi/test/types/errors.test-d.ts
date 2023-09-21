import { expectType } from 'tsd'
import { FastifyError } from '@fastify/error'
import {
  errors
} from '../../index'

// Errors
type ErrorWithNoParams = () => FastifyError
expectType<ErrorWithNoParams>(errors.UnableToCreateTheRouteForTheReverseRelationshipError)
expectType<ErrorWithNoParams>(errors.UnableToCreateTheRouteForThePKColRelationshipError)


