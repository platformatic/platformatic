import { expect, test } from 'tstyche'
import type { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import {
  create,
  loadConfiguration,
  prepareApplication,
  transform,
  type ApplicationsTopology,
  type Runtime,
  type RuntimeConfiguration,
  type RuntimeCreateContext,
  type ApplicationDetails,
  type InjectParams,
  type InjectResponse,
  type RuntimeExtension,
  type RuntimeExtensionContext,
  type RuntimeExtensionInstance,
  type RuntimeExtensionMetrics,
  type RuntimeExtensionSharedContext,
  type RuntimeMetadata,
  type WorkerDetails,
  type WorkerLifecycleEvent,
  type ProfileCapturedEvent,
  type RuntimeHealthSignal,
  type HealthMetricsEvent
} from '../../index.js'
import type { PlatformaticRuntimeConfig } from '../../config.js'

const context = {} as Configuration

test('create', () => {
  expect(create('.')).type.toBe<Promise<Runtime>>()

  expect(create('.', './config.json')).type.toBe<Promise<Runtime>>()
  expect(create('.', { baseUrl: 'http://localhost:3000' })).type.toBe<Promise<Runtime>>()

  expect(create('.', './config.json', context)).type.toBe<Promise<Runtime>>()

  // isProduction/setupSignals are real, documented Runtime-only create()
  // options; setupSignals is Runtime-only, isProduction lives on the shared
  // ConfigurationOptions.
  const runtimeContext: RuntimeCreateContext = { isProduction: true, setupSignals: false }
  expect(create('.', './config.json', runtimeContext)).type.toBe<Promise<Runtime>>()

  // The runtime invokes a caller-supplied transform hook with three
  // arguments (config, schema, options), not just the config.
  expect(create('.', './config.json', {
    transform: async (config, schema, options) => {
      expect(schema).type.toBe<object>()
      expect(options).type.toBe<ConfigurationOptions<PlatformaticRuntimeConfig>>()
      return config
    }
  })).type.toBe<Promise<Runtime>>()
})

test('prepareApplication', () => {
  const config = {} as RuntimeConfiguration
  expect(prepareApplication(config, {})).type.toBe<Promise<object>>()
  expect(prepareApplication(config, {}, config.workers)).type.toBe<Promise<object>>()
})

test('transform', () => {
  const config = {} as RuntimeConfiguration
  expect(transform(config)).type.toBe<Promise<RuntimeConfiguration>>()
  expect(transform(config, {}, context)).type.toBe<Promise<RuntimeConfiguration>>()
})

test('loadConfiguration', () => {
  expect(loadConfiguration('.')).type.toBe<Promise<RuntimeConfiguration>>()
  expect(loadConfiguration({ baseUrl: 'http://localhost:3000' })).type.toBe<Promise<RuntimeConfiguration>>()

  expect(loadConfiguration('.', './config.json')).type.toBe<Promise<RuntimeConfiguration>>()
  expect(loadConfiguration('.', { baseUrl: 'http://localhost:3000' })).type.toBe<Promise<RuntimeConfiguration>>()

  expect(loadConfiguration('.', './config.json', context)).type.toBe<Promise<RuntimeConfiguration>>()
  expect(loadConfiguration({ baseUrl: 'http://localhost:3000' }, './config.json', context)).type.toBe<Promise<RuntimeConfiguration>>()
})

const runtime = {} as Runtime

test('Runtime.init', () => {
  expect(runtime.init()).type.toBe<Promise<void>>()
})

test('Runtime.start', () => {
  expect(runtime.start()).type.toBe<Promise<string | undefined>>()
  expect(runtime.start(true)).type.toBe<Promise<string | undefined>>()
})

test('Runtime.stop', () => {
  expect(runtime.stop()).type.toBe<Promise<void>>()
  expect(runtime.stop(false)).type.toBe<Promise<void>>()
})

test('Runtime.close', () => {
  expect(runtime.close()).type.toBe<Promise<void>>()
  expect(runtime.close(true)).type.toBe<Promise<void>>()
})

test('Runtime.restart', () => {
  expect(runtime.restart()).type.toBe<Promise<string | undefined>>()
  expect(runtime.restart(['api', 'worker'])).type.toBe<Promise<string | undefined>>()
})

test('Runtime.inject', () => {
  const params: InjectParams = { url: '/health' }
  expect(runtime.inject('api', params)).type.toBe<Promise<InjectResponse>>()
  expect(runtime.inject('api', { method: 'POST', url: '/seed', body: {} })).type.toBe<Promise<InjectResponse>>()
})

test('Runtime.getUrl', () => {
  expect(runtime.getUrl()).type.toBe<string | undefined>()
})

test('Runtime.getRuntimeStatus', () => {
  expect(runtime.getRuntimeStatus()).type.toBe<string>()
})

test('Runtime.getRuntimeMetadata', () => {
  expect(runtime.getRuntimeMetadata()).type.toBe<Promise<RuntimeMetadata>>()
})

test('Runtime.getRuntimeEnv', () => {
  expect(runtime.getRuntimeEnv()).type.toBe<Record<string, string>>()
})

test('Runtime.getRuntimeConfig', () => {
  expect(runtime.getRuntimeConfig()).type.toBe<Record<string, unknown>>()
  // Passing `true` returns the full merged Configuration (carrying the
  // kMetadata symbol), not a plain Record.
  expect(runtime.getRuntimeConfig(true)).type.toBe<RuntimeConfiguration>()
})

test('Runtime.setApplicationConfigPatch', () => {
  expect(runtime.setApplicationConfigPatch('api', [{ op: 'replace', path: '/foo', value: 'bar' }])).type.toBe<void>()
})

test('Runtime.removeApplicationConfigPatch', () => {
  expect(runtime.removeApplicationConfigPatch('api')).type.toBe<void>()
})

test('Runtime.getApplicationsIds', () => {
  expect(runtime.getApplicationsIds()).type.toBe<string[]>()
})

test('Runtime.getApplications', () => {
  expect(runtime.getApplications()).type.toBe<Promise<ApplicationsTopology>>()
  expect(runtime.getApplications(true)).type.toBe<Promise<ApplicationsTopology>>()
})

test('Runtime.getWorkers', () => {
  expect(runtime.getWorkers()).type.toBe<Promise<Record<string, WorkerDetails>>>()
  expect(runtime.getWorkers(true)).type.toBe<Promise<Record<string, WorkerDetails>>>()
})

test('Runtime.getApplicationDetails', () => {
  expect(runtime.getApplicationDetails('api')).type.toBe<Promise<ApplicationDetails>>()
  expect(runtime.getApplicationDetails('api', true)).type.toBe<Promise<ApplicationDetails>>()
})

test('Runtime.getApplicationConfig', () => {
  expect(runtime.getApplicationConfig('api')).type.toBe<Promise<Record<string, unknown>>>()
  expect(runtime.getApplicationConfig('api', false)).type.toBe<Promise<Record<string, unknown>>>()
})

test('Runtime.getApplicationEnv', () => {
  expect(runtime.getApplicationEnv('api')).type.toBe<Promise<Record<string, string>>>()
  expect(runtime.getApplicationEnv('api', false)).type.toBe<Promise<Record<string, string>>>()
})

test('Runtime.getApplicationOpenapiSchema', () => {
  expect(runtime.getApplicationOpenapiSchema('api')).type.toBe<Promise<unknown>>()
})

test('Runtime.getApplicationGraphqlSchema', () => {
  expect(runtime.getApplicationGraphqlSchema('api')).type.toBe<Promise<unknown>>()
})

test('Runtime.getMetrics', () => {
  expect(runtime.getMetrics()).type.toBe<Promise<{ metrics: unknown }>>()
  expect(runtime.getMetrics('text')).type.toBe<Promise<{ metrics: unknown }>>()
})

test('Runtime.getSharedContext', () => {
  expect(runtime.getSharedContext()).type.toBe<object>()
})

test('Runtime.updateSharedContext', () => {
  expect(runtime.updateSharedContext()).type.toBe<Promise<object>>()
  expect(runtime.updateSharedContext({ context: { foo: 'bar' } })).type.toBe<Promise<object>>()
  expect(runtime.updateSharedContext({ context: { foo: 'bar' }, overwrite: true })).type.toBe<Promise<object>>()
})

test('Runtime.startApplication', () => {
  expect(runtime.startApplication('api')).type.toBe<Promise<void>>()
  expect(runtime.startApplication('api', true)).type.toBe<Promise<void>>()
})

test('Runtime.stopApplication', () => {
  expect(runtime.stopApplication('api')).type.toBe<Promise<void>>()
  expect(runtime.stopApplication('api', false)).type.toBe<Promise<void>>()
})

test('Runtime.restartApplication', () => {
  expect(runtime.restartApplication('api')).type.toBe<Promise<void>>()
})

test('Runtime.addApplications', () => {
  expect(runtime.addApplications([])).type.toBe<Promise<ApplicationDetails[]>>()
  expect(runtime.addApplications([], true)).type.toBe<Promise<ApplicationDetails[]>>()
})

test('Runtime.removeApplications', () => {
  expect(runtime.removeApplications(['api'])).type.toBe<Promise<ApplicationDetails[]>>()
  expect(runtime.removeApplications(['api'], true)).type.toBe<Promise<ApplicationDetails[]>>()
})

test('Runtime.startApplicationProfiling', () => {
  expect(runtime.startApplicationProfiling('api')).type.toBe<Promise<void>>()
  expect(runtime.startApplicationProfiling('api', { type: 'cpu' }, true)).type.toBe<Promise<void>>()
  expect(runtime.startApplicationProfiling('api', { type: 'cpu', allWorkers: true }, true)).type.toBe<
    Promise<{ workers: number[] }>
  >()
})

test('Runtime.stopApplicationProfiling', () => {
  expect(runtime.stopApplicationProfiling('api')).type.toBe<Promise<Buffer>>()
  expect(runtime.stopApplicationProfiling('api', { type: 'cpu' }, true)).type.toBe<Promise<Buffer>>()
  expect(runtime.stopApplicationProfiling('api', { type: 'cpu', includeSampleCount: true }, true)).type.toBe<
    Promise<{ profile: Buffer, sampleCount: number }>
  >()
  expect(runtime.stopApplicationProfiling('api', { type: 'cpu', allWorkers: true }, true)).type.toBe<
    Promise<Array<{ workerIndex: number, profile: Buffer }>>
  >()
})

test('Runtime.getApplicationLastProfile', () => {
  expect(runtime.getApplicationLastProfile('api')).type.toBe<
    Promise<{ profile: Buffer, timestamp: number | null, sampleCount: number | null, preserved: boolean }>
  >()
  expect(runtime.getApplicationLastProfile('api:0', { type: 'cpu' }, true)).type.toBe<
    Promise<{ profile: Buffer, timestamp: number | null, sampleCount: number | null, preserved: boolean }>
  >()
})

test('RuntimeExtension', () => {
  const extension: RuntimeExtension = async ({
    runtime,
    itc,
    logger,
    options,
    root,
    sharedContext,
    metrics
  }: RuntimeExtensionContext) => {
    expect(runtime).type.toBe<Runtime>()
    expect(options).type.toBe<Record<string, unknown>>()
    expect(root).type.toBe<string>()
    expect(sharedContext).type.toBe<RuntimeExtensionSharedContext>()
    expect(metrics).type.toBe<RuntimeExtensionMetrics>()
    expect(metrics.registry).type.toBe<RuntimeExtensionMetrics['registry']>()

    logger.info('loaded')

    itc.handle('custom:command', payload => payload)
    expect(itc.send<number>('api', 'custom:command', { value: 42 })).type.toBe<Promise<number>>()
    expect(itc.notify('api', 'custom:event', { value: 42 })).type.toBe<Promise<void>>()

    expect(sharedContext.get()).type.toBe<object | Promise<object>>()
    expect(sharedContext.update({ feature: true })).type.toBe<Promise<void>>()
    expect(sharedContext.update({ feature: false }, { overwrite: true })).type.toBe<Promise<void>>()

    // Newly public control-plane methods are callable from extensions
    expect(runtime.getApplications()).type.toBe<Promise<ApplicationsTopology>>()
    expect(runtime.getWorkers()).type.toBe<Promise<Record<string, WorkerDetails>>>()
    expect(runtime.getApplicationConfig('api')).type.toBe<Promise<Record<string, unknown>>>()
    expect(runtime.getApplicationEnv('api')).type.toBe<Promise<Record<string, string>>>()
    expect(runtime.getMetrics()).type.toBe<Promise<{ metrics: unknown }>>()
    expect(runtime.getSharedContext()).type.toBe<object>()
    expect(runtime.updateSharedContext({ context: { fromExtension: true } })).type.toBe<Promise<object>>()

    return {
      async start () {},
      async stop () {},
      async close () {}
    }
  }

  expect(extension).type.toBe<RuntimeExtension>()

  const instance: RuntimeExtensionInstance = {}
  expect(instance.start).type.toBe<(() => void | Promise<void>) | undefined>()
  expect(instance.stop).type.toBe<(() => void | Promise<void>) | undefined>()
  expect(instance.close).type.toBe<(() => void | Promise<void>) | undefined>()
})

test('WorkerLifecycleEvent', () => {
  const event: WorkerLifecycleEvent = { application: 'api', worker: 0 }
  expect(event).type.toBe<WorkerLifecycleEvent>()

  const withWorkersCount: WorkerLifecycleEvent = { application: 'api', worker: 0, workersCount: 2 }
  expect(withWorkersCount).type.toBe<WorkerLifecycleEvent>()
})

test('ProfileCapturedEvent', () => {
  const event: ProfileCapturedEvent = {
    application: 'api',
    worker: 0,
    id: 'api:0',
    type: 'cpu',
    timestamp: Date.now(),
    sampleCount: null
  }
  expect(event).type.toBe<ProfileCapturedEvent>()
})

test('RuntimeHealthSignal', () => {
  const signal: RuntimeHealthSignal = { type: 'eventLoopDelay', max: 10, mean: 5, p99: 8 }
  expect(signal).type.toBe<RuntimeHealthSignal>()

  const minimal: RuntimeHealthSignal = { type: 'custom' }
  expect(minimal).type.toBe<RuntimeHealthSignal>()
})

test('HealthMetricsEvent', () => {
  const event: HealthMetricsEvent = {
    application: 'api',
    worker: 0,
    id: 'api:0',
    healthSignals: [{ type: 'eventLoopDelay', p99: 8 }]
  }
  expect(event).type.toBe<HealthMetricsEvent>()
})

test('Runtime.on — application:worker:started', () => {
  const handler = (event: WorkerLifecycleEvent) => {
    expect(event.application).type.toBe<string>()
    expect(event.worker).type.toBe<number>()
  }
  runtime.on('application:worker:started', handler)
})

test('Runtime.on — application:worker:exited', () => {
  const handler = (event: WorkerLifecycleEvent) => {
    expect(event.application).type.toBe<string>()
    expect(event.worker).type.toBe<number>()
  }
  runtime.on('application:worker:exited', handler)
})

test('Runtime.on — application:worker:profile:captured', () => {
  const handler = (event: ProfileCapturedEvent) => {
    expect(event.id).type.toBe<string>()
    expect(event.type).type.toBe<string>()
    expect(event.timestamp).type.toBe<number>()
    expect(event.sampleCount).type.toBe<number | null>()
  }
  runtime.on('application:worker:profile:captured', handler)
})

test('Runtime.on — application:worker:health:metrics', () => {
  const handler = (event: HealthMetricsEvent) => {
    expect(event.id).type.toBe<string>()
    expect(event.healthSignals).type.toBe<RuntimeHealthSignal[]>()
  }
  runtime.on('application:worker:health:metrics', handler)
})

test('Runtime.off — typed event removal', () => {
  const handler = (event: WorkerLifecycleEvent) => {}
  runtime.off('application:worker:started', handler)
  runtime.off('application:worker:exited', handler)
})
