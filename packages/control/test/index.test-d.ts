import { FastifyError } from '@fastify/error'
import { expectAssignable, expectError, expectType } from 'tsd'
import {
  FailedToGetRuntimeAllLogs,
  FailedToGetRuntimeConfig,
  FailedToGetRuntimeEnv,
  FailedToGetRuntimeHistoryLogs,
  FailedToGetRuntimeOpenapi
} from '../lib/errors.js'
import { Metric, ReadableBody, Runtime, RuntimeApiClient, RuntimeServices } from '../lib/index.js'

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

async function unused () {
  const result = await api.injectRuntime(0, '', { body: {}, headers: {}, method: 'PUT', url: '/foo' })

  expectType<ReadableBody>(result.body)
  expectType<number>(result.statusCode)
  expectAssignable<Record<string, unknown>>(result.headers)
  return result
}

const [service1] = service.services
expectType<Promise<Record<string, unknown>>>(api.getRuntimeOpenapi(runtime.pid, service1.id))
expectType<string[]>(runtime.argv)
expectType<number>(runtime.uptimeSeconds)
expectType<string | null>(runtime.packageVersion)
expectType<
  Promise<{
    entrypoint: string
    production: boolean
    services: RuntimeServices['services']
  }>
>(api.getRuntimeServices(45))
expectType<string>(service1.id)
expectType<string>(service1.status)

if ('url' in service1) {
  expectType<string | undefined>(service1.url)
  expectType<number | undefined>(service1.workers)
}

expectType<string>(metric.aggregator)
expectType<string>(metric.values[0].labels.serviceId)
expectType<number | undefined>(metric.values[0].labels?.quantile)
expectType<string | undefined>(metric.values[0].labels?.route)
expectType<string | undefined>(metric.values[0].labels?.method)
expectType<number | undefined>(metric.values[0].labels?.status_code)
expectType<string | undefined>(metric.values[0].labels?.telemetry_id)
expectType<number | undefined>(metric.values[0].labels?.workerId)
expectType<string | undefined>(metric.values[0].labels?.dispatcher_stats_url)
expectType<string | undefined>(metric.values[0].metricName)
expectType<unknown | undefined>(metric.values[0].exemplar)
expectType<Promise<void>>(api.close())

// errors
expectType<(arg: string) => FastifyError>(FailedToGetRuntimeAllLogs)
expectType<(arg: string) => FastifyError>(FailedToGetRuntimeConfig)
expectType<(arg: string) => FastifyError>(FailedToGetRuntimeEnv)
expectType<(arg: string) => FastifyError>(FailedToGetRuntimeOpenapi)
expectType<(arg: string) => FastifyError>(FailedToGetRuntimeHistoryLogs)
expectError<string>(FailedToGetRuntimeHistoryLogs)
expectError<number>(FailedToGetRuntimeHistoryLogs)
