import { expectType, expectAssignable } from 'tsd'
import { BaseCapability, StartOptions, BaseContext, BaseOptions, schemaOptions } from '../../index'

// Test StartOptions interface
expectAssignable<StartOptions>({ listen: true })
expectAssignable<StartOptions>({ listen: false })
expectAssignable<StartOptions>({})
expectAssignable<StartOptions>({ listen: undefined })

// Test BaseContext interface
expectAssignable<BaseContext>({})
expectAssignable<BaseContext>({
  applicationId: 'test-app',
  isEntrypoint: true,
  isProduction: false,
  isStandalone: true,
  directory: '/path/to/dir',
  telemetryConfig: { enabled: true },
  metricsConfig: { port: 3000 },
  serverConfig: { host: 'localhost' },
  hasManagementApi: true
})

// Test partial nature of BaseContext
expectAssignable<BaseContext>({ applicationId: 'test' })
expectAssignable<BaseContext>({ isProduction: true })

// Test BaseOptions interface
expectAssignable<BaseOptions>({
  context: {}
})

expectAssignable<BaseOptions<BaseContext>>({
  context: {
    applicationId: 'test',
    isProduction: true
  }
})

// Test schemaOptions
expectType<Partial<Record<string, unknown>>>(schemaOptions)

// Test BaseCapability class constructor
const capability = new BaseCapability(
  'test-type',
  '1.0.0',
  '/root/path',
  { setting: 'value' }
)

expectType<BaseCapability>(capability)
expectType<string | null>(capability.basePath)

// Test with optional standardStreams parameter
const capabilityWithStreams = new BaseCapability(
  'test-type',
  '1.0.0',
  '/root/path',
  { setting: 'value' },
  { stdout: process.stdout, stderr: process.stderr }
)

expectType<BaseCapability>(capabilityWithStreams)

// Test method return types
expectType<Promise<void>>(capability.init())
expectType<Promise<string | void>>(capability.start({ listen: true }))
expectType<Promise<void>>(capability.close())
expectType<Promise<void>>(capability.stop())
expectType<Promise<void>>(capability.build())
expectType<string>(capability.getUrl())
expectType<Promise<void>>(capability.updateContext({ applicationId: 'new-id' }))
expectType<Promise<object>>(capability.getConfig())
expectType<Promise<object>>(capability.getConfig(true))
expectType<Promise<{ type: string; version: string; dependencies: string[] }>>(capability.getInfo())
expectType<BaseCapability>(capability.getDispatchFunc())
expectType<Promise<BaseCapability | string>>(capability.getDispatchTarget())
expectType<Promise<object | null>>(capability.getOpenapiSchema())
expectType<Promise<unknown>>(capability.getGraphqlSchema())
expectType<void>(capability.setOpenapiSchema({}))
expectType<void>(capability.setGraphqlSchema('schema'))

// Test health check methods
expectType<void>(capability.setCustomHealthCheck(() => true))
expectType<void>(capability.setCustomHealthCheck(() => Promise.resolve(true)))
expectType<void>(capability.setCustomHealthCheck(() => ({
  status: true,
  statusCode: 200,
  body: 'OK'
})))
expectType<void>(capability.setCustomHealthCheck(() => Promise.resolve({
  status: false,
  statusCode: 503
})))

// Test readiness check methods
expectType<void>(capability.setCustomReadinessCheck(() => true))
expectType<void>(capability.setCustomReadinessCheck(() => Promise.resolve({
  status: true,
  statusCode: 200,
  body: 'Ready'
})))
expectType<Promise<boolean | { status: boolean; statusCode?: number; body?: string }>>(capability.getCustomHealthCheck())
expectType<Promise<boolean | { status: boolean; statusCode?: number; body?: string }>>(capability.getCustomReadinessCheck())

// Test metrics methods
expectType<Promise<string | Array<object>>>(capability.getMetrics())
expectType<Promise<string | Array<object>>>(capability.getMetrics({ format: 'json' }))
expectType<Promise<object>>(capability.getMeta())

// Test inject method
expectType<Promise<{
  statusCode: number
  statusMessage: string
  headers: object
  body: object
}>>(capability.inject('test'))

expectType<Promise<{
  statusCode: number
  statusMessage: string
  headers: object
  body: object
}>>(capability.inject({ method: 'GET', url: '/test' }))

// Test log method
expectType<void>(capability.log({ message: 'test', level: 'info' }))

// Test watch config method
expectType<Promise<{
  enabled: boolean
  path: string
  allow?: string[]
  ignore?: string[]
}>>(capability.getWatchConfig())

// Test private methods (they should still be accessible for type checking)
expectType<object>(capability._initializeLogger())
expectType<Promise<void>>(capability._collectMetrics())
