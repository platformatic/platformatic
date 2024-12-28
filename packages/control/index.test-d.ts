import { expectError, expectType } from 'tsd'
import { errors, Runtime, RuntimeApiClient, Services } from '.'
import { FastifyError } from '@fastify/error'

// RuntimeApiClient
let runtime = {} as Runtime
let services = {} as Services
const api = new RuntimeApiClient()
expectType<Promise<Runtime[]>>(api.getRuntimes())
expectType<string[]>(runtime.argv)
expectType<number>(runtime.uptimeSeconds)
expectType<string | null>(runtime.packageVersion)
expectType<Promise<{
  entrypoint: string,
  production: boolean,
  services: Services['services']
}>>(api.getRuntimeServices(45))
expectType<string>(services.services[0].id)
expectType<string>(services.services[0].status)
expectType<Promise<void>>(api.close())

// errors
expectType<FastifyError>(errors.FailedToGetRuntimeAllLogs)
expectType<FastifyError>(errors.FailedToGetRuntimeConfig)
expectType<FastifyError>(errors.FailedToGetRuntimeEnv)
expectType<FastifyError>(errors.FailedToGetRuntimeHistoryLogs)
expectError<string>(errors.FailedToGetRuntimeHistoryLogs)
expectError<number>(errors.FailedToGetRuntimeHistoryLogs)
