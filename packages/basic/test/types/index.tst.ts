import { expect, test } from 'tstyche';
import { BaseCapability, schemaOptions } from '../../index.js';
import type { StartOptions, BaseContext, BaseOptions } from '../../index.js';

// Test StartOptions interface
test('StartOptions interface', () => {
  expect({ listen: true }).type.toBeAssignableTo<StartOptions>();
  expect({ listen: false }).type.toBeAssignableTo<StartOptions>();
  expect({}).type.toBeAssignableTo<StartOptions>();
});

// Test BaseContext interface
test('BaseContext interface', () => {
  expect({}).type.toBeAssignableTo<BaseContext>();
  expect({
    applicationId: 'test-app',
    isEntrypoint: true,
    isProduction: false,
    isStandalone: true,
    directory: '/path/to/dir',
    telemetryConfig: { enabled: true },
    metricsConfig: { port: 3000 },
    serverConfig: { host: 'localhost' },
    hasManagementApi: true
  }).type.toBeAssignableTo<BaseContext>();
});

// Test partial nature of BaseContext
test('BaseContext partial nature', () => {
  expect({ applicationId: 'test' }).type.toBeAssignableTo<BaseContext>();
  expect({ isProduction: true }).type.toBeAssignableTo<BaseContext>();
});

// Test BaseOptions interface
test('BaseOptions interface', () => {
  expect({
    context: {}
  }).type.toBeAssignableTo<BaseOptions>();

  expect({
    context: {
      applicationId: 'test',
      isProduction: true
    }
  }).type.toBeAssignableTo<BaseOptions<BaseContext>>();
});

// Test schemaOptions
test('schemaOptions', () => {
  expect(schemaOptions).type.toBe<Partial<Record<string, unknown>>>();
});

// Test BaseCapability class constructor
const capability = new BaseCapability('test-type', '1.0.0', '/root/path', {
  setting: 'value'
});

const capabilityWithStreams = new BaseCapability(
  'test-type',
  '1.0.0',
  '/root/path',
  { setting: 'value' },
  { stdout: process.stdout, stderr: process.stderr }
);

test('BaseCapability class constructor', () => {
  expect(capability).type.toBe<BaseCapability>();
  expect(capability.basePath).type.toBe<string | null>();

  // Test with optional standardStreams parameter
  expect(capabilityWithStreams).type.toBe<BaseCapability>();
});

// Test method return types
test('method return types', () => {
  expect(capability.init()).type.toBe<Promise<void>>();
  expect(capability.start({ listen: true })).type.toBe<
    Promise<string | void>
  >();
  expect(capability.close()).type.toBe<Promise<void>>();
  expect(capability.stop()).type.toBe<Promise<void>>();
  expect(capability.build()).type.toBe<Promise<void>>();
  expect(capability.getUrl()).type.toBe<string>();
  expect(capability.updateContext({ applicationId: 'new-id' })).type.toBe<
    Promise<void>
  >();
  expect(capability.getConfig()).type.toBe<Promise<object>>();
  expect(capability.getConfig(true)).type.toBe<Promise<object>>();
  expect(capability.getInfo()).type.toBe<
    Promise<{ type: string; version: string; dependencies: string[] }>
  >();
  expect(capability.getDispatchFunc()).type.toBe<BaseCapability>();
  expect(capability.getDispatchTarget()).type.toBe<
    Promise<BaseCapability | string>
  >();
  expect(capability.getOpenapiSchema()).type.toBe<Promise<object | null>>();
  expect(capability.getGraphqlSchema()).type.toBe<Promise<unknown>>();
  expect(capability.setOpenapiSchema({})).type.toBe<void>();
  expect(capability.setGraphqlSchema('schema')).type.toBe<void>();
});

// Test health check methods
test('health check methods', () => {
  expect(capability.setCustomHealthCheck(() => true)).type.toBe<void>();
  expect(
    capability.setCustomHealthCheck(() => Promise.resolve(true))
  ).type.toBe<void>();
  expect(
    capability.setCustomHealthCheck(() => ({
      status: true,
      statusCode: 200,
      body: 'OK'
    }))
  ).type.toBe<void>();
  expect(
    capability.setCustomHealthCheck(() =>
      Promise.resolve({
        status: false,
        statusCode: 503
      })
    )
  ).type.toBe<void>();
});

// Test readiness check methods
test('readiness check methods', () => {
  expect(capability.setCustomReadinessCheck(() => true)).type.toBe<void>();
  expect(
    capability.setCustomReadinessCheck(() =>
      Promise.resolve({
        status: true,
        statusCode: 200,
        body: 'Ready'
      })
    )
  ).type.toBe<void>();
  expect(capability.getCustomHealthCheck()).type.toBe<
    Promise<boolean | { status: boolean; statusCode?: number; body?: string }>
  >();
  expect(capability.getCustomReadinessCheck()).type.toBe<
    Promise<boolean | { status: boolean; statusCode?: number; body?: string }>
  >();
});

// Test metrics methods
test('metrics methods', () => {
  expect(capability.getMetrics()).type.toBe<Promise<string | Array<object>>>();
  expect(capability.getMetrics({ format: 'json' })).type.toBe<
    Promise<string | Array<object>>
  >();
  expect(capability.getMeta()).type.toBe<Promise<object>>();
});

// Test inject method
test('inject method', () => {
  expect(capability.inject('test')).type.toBe<
    Promise<{
      statusCode: number;
      statusMessage: string;
      headers: object;
      body: object;
    }>
  >();

  expect(capability.inject({ method: 'GET', url: '/test' })).type.toBe<
    Promise<{
      statusCode: number;
      statusMessage: string;
      headers: object;
      body: object;
    }>
  >();
});

// Test log method
test('log method', () => {
  expect(capability.log({ message: 'test', level: 'info' })).type.toBe<void>();
});

// Test watch config method
test('watch config method', () => {
  expect(capability.getWatchConfig()).type.toBe<
    Promise<{
      enabled: boolean;
      path: string;
      allow?: string[];
      ignore?: string[];
    }>
  >();
});

// Test private methods (they should still be accessible for type checking)
test('private methods', () => {
  expect(capability._initializeLogger()).type.toBe<object>();
  expect(capability._collectMetrics()).type.toBe<Promise<void>>();
});
