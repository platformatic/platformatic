import { expectError, expectType } from 'tsd'
import { errors, RuntimeApiClient } from '.'
import { FastifyError } from '@fastify/error'

// RuntimeApiClient
const api = new RuntimeApiClient()
expectType<Promise<unknown[]>>(api.getRuntimes())
expectType<Promise<void>>(api.close())

// errors
expectType<FastifyError>(errors.FailedToGetRuntimeAllLogs)
expectType<FastifyError>(errors.FailedToGetRuntimeConfig)
expectType<FastifyError>(errors.FailedToGetRuntimeEnv)
expectType<FastifyError>(errors.FailedToGetRuntimeHistoryLogs)
expectError<string>(errors.FailedToGetRuntimeHistoryLogs)
expectError<number>(errors.FailedToGetRuntimeHistoryLogs)
