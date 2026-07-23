import { expect, test } from 'tstyche'
import type { Configuration } from '@platformatic/foundation'
import {
  create,
  loadConfiguration,
  type ApplicationsTopology,
  type Runtime,
  type RuntimeConfiguration,
  type ApplicationDetails,
  type InjectParams,
  type InjectResponse,
  type RuntimeExtension,
  type RuntimeExtensionContext,
  type RuntimeExtensionInstance,
  type RuntimeExtensionMetrics,
  type RuntimeExtensionSharedContext,
  type RuntimeMetadata,
  type WorkerDetails
} from '../../index.js'

const context = {} as Configuration

test('create', () => {
  expect(create('.')).type.toBe<Promise<Runtime>>()

  expect(create('.', './config.json')).type.toBe<Promise<Runtime>>()
  expect(create('.', { baseUrl: 'http://localhost:3000' })).type.toBe<Promise<Runtime>>()

  expect(create('.', './config.json', context)).type.toBe<Promise<Runtime>>()
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
  expect(runtime.getRuntimeConfig(true)).type.toBe<Record<string, unknown>>()
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
})

test('Runtime.stopApplicationProfiling', () => {
  expect(runtime.stopApplicationProfiling('api')).type.toBe<Promise<Buffer>>()
  expect(runtime.stopApplicationProfiling('api', { type: 'cpu' }, true)).type.toBe<Promise<Buffer>>()
})

test('Runtime.getApplicationLastProfile', () => {
  expect(runtime.getApplicationLastProfile('api')).type.toBe<
    Promise<{ profile: Buffer, timestamp: number | null, preserved: boolean }>
  >()
  expect(runtime.getApplicationLastProfile('api:0', { type: 'cpu' }, true)).type.toBe<
    Promise<{ profile: Buffer, timestamp: number | null, preserved: boolean }>
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
