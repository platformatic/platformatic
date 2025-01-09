import { expectError, expectType } from 'tsd'
import { errors, Metric, Runtime, RuntimeApiClient, RuntimeServices } from '.'
import { FastifyError } from '@fastify/error'

// RuntimeApiClient
let runtime = {} as Runtime
let service = {} as RuntimeServices
let metric = {} as Metric
const api = new RuntimeApiClient()
expectType<Promise<Runtime>>(api.getMatchingRuntime())
expectType<Promise<Metric[]>>(api.getRuntimeMetrics(runtime.pid))
expectType<Promise<Metric[]>>(api.getRuntimeMetrics(runtime.pid, {}))
expectType<Promise<Metric[]>>(api.getRuntimeMetrics(runtime.pid, { format: 'json' }))
expectType<Promise<string>>(api.getRuntimeMetrics(runtime.pid, { format: 'text' }))
expectType<Promise<Runtime[]>>(api.getRuntimes())
expectType<Promise<unknown>>(api.getRuntimeOpenapi(runtime.pid, service.services[0].id))
expectType<string[]>(runtime.argv)
expectType<number>(runtime.uptimeSeconds)
expectType<string | null>(runtime.packageVersion)
expectType<Promise<{
  entrypoint: string,
  production: boolean,
  services: RuntimeServices['services']
}>>(api.getRuntimeServices(45))
expectType<string>(service.services[0].id)
expectType<string>(service.services[0].status)
expectType<string>(metric.aggregator)
expectType<string>(metric.values[0].labels.serviceId)
expectType<Promise<void>>(api.close())

// errors
expectType<FastifyError>(errors.FailedToGetRuntimeAllLogs)
expectType<FastifyError>(errors.FailedToGetRuntimeConfig)
expectType<FastifyError>(errors.FailedToGetRuntimeEnv)
expectType<FastifyError>(errors.FailedToGetRuntimeOpenapi)
expectType<FastifyError>(errors.FailedToGetRuntimeHistoryLogs)
expectError<string>(errors.FailedToGetRuntimeHistoryLogs)
expectError<number>(errors.FailedToGetRuntimeHistoryLogs)
