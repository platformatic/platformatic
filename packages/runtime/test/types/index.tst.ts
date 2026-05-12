import { expect, test } from 'tstyche'
import type { Configuration } from '@platformatic/foundation'
import { create, loadConfiguration, type Runtime, type RuntimeConfiguration, type ApplicationDetails, type InjectParams, type InjectResponse, type RuntimeMetadata } from '../../index.js'

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
  expect(runtime.start()).type.toBe<Promise<void>>()
  expect(runtime.start(true)).type.toBe<Promise<void>>()
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

test('Runtime.getApplicationDetails', () => {
  expect(runtime.getApplicationDetails('api')).type.toBe<Promise<ApplicationDetails>>()
  expect(runtime.getApplicationDetails('api', true)).type.toBe<Promise<ApplicationDetails>>()
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
