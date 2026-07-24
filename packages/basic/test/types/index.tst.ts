import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:net';
import { expect, test } from 'tstyche';
import {
  BaseCapability,
  ChildManager,
  buildAdditionalServerOptions,
  buildFastifyOptions,
  buildListenOptions,
  cleanBasePath,
  create,
  createChildProcessListener,
  createServerListener,
  ensureFileUrl,
  ensureTrailingSlash,
  errors,
  findConfigurationFile,
  generateChildrenId,
  getServerUrl,
  getSocketPath,
  importCapabilityAndConfig,
  importCapabilityPackage,
  importFile,
  injectViaRequest,
  isImportFailedError,
  isWindows,
  packageJson,
  resolve,
  resolvePackage,
  resolvePackageViaCJS,
  resolvePackageViaESM,
  schema,
  schemaComponents,
  schemaOptions,
  transform,
  validationOptions,
  version
} from '../../index.js';
import type {
  BaseContext,
  BaseOptions,
  CancellablePromise,
  InjectViaRequestResponse,
  PlatformaticBasicConfig,
  StartOptions
} from '../../index.js';

declare const server: Server;

// Test StartOptions interface
test('StartOptions interface', () => {
  expect({ listen: true }).type.toBeAssignableTo<StartOptions>();
  expect({ listen: false }).type.toBeAssignableTo<StartOptions>();
  expect({}).type.toBeAssignableTo<StartOptions>();
  expect({ listen: undefined }).type.toBeAssignableTo<StartOptions>();
});

// Test BaseContext interface
test('BaseContext interface', () => {
  expect({}).type.toBeAssignableTo<BaseContext>();
  expect({
    applicationId: 'test-app',
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

test('config and schema exports', () => {
  expect(packageJson).type.toBe<Record<string, unknown>>();
  expect(schema).type.toBeAssignableTo<object>();
  expect(schemaComponents.application).type.toBeAssignableTo<object>();
  expect(schemaComponents.buildableApplication).type.toBeAssignableTo<object>();
  expect(schemaComponents.watch).type.toBeAssignableTo<object>();
  expect(version).type.toBe<string>();
  expect(findConfigurationFile('/path/to/root', 'application')).type.toBe<Promise<string>>();
  expect(resolve('/path/to/root')).type.toBe<Promise<{ root: string; source: string | Record<string, unknown> }>>();
  expect(transform<PlatformaticBasicConfig>({})).type.toBe<Promise<PlatformaticBasicConfig>>();
  expect(validationOptions.useDefaults).type.toBe<true>();
});

test('creation and module helpers', () => {
  expect(create('/path/to/root')).type.toBe<Promise<unknown>>();
  expect(isImportFailedError(new Error(), '@platformatic/node')).type.toBe<boolean>();
  expect(importCapabilityPackage('/path/to/root', '@platformatic/node')).type.toBe<Promise<unknown>>();
  expect(importCapabilityAndConfig('/path/to/root', 'platformatic.json')).type.toBe<
    Promise<{
      capability: unknown;
      config: string | Record<string, unknown>;
      autodetectDescription: string;
      moduleName: string;
    }>
  >();
});

test('errors namespace', () => {
  expect(errors.ERROR_PREFIX).type.toBe<'PLT_BASIC'>();
  expect(errors.exitCodes.MANAGER_MESSAGE_HANDLING_FAILED).type.toBe<11>();
  expect(errors.exitCodes.PROCESS_UNHANDLED_ERROR).type.toBe<20>();
  expect(errors.UnsupportedVersion('node', '1.0.0', '2.0.0')).type.toBe<Error>();
  expect(errors.NonZeroExitCode(1)).type.toBe<Error>();
});

test('utility exports', () => {
  expect(buildListenOptions({ port: 3042, hostname: '127.0.0.1' })).type.toBe<{
    port: number | string;
    host?: string;
  }>();
  expect(buildAdditionalServerOptions({ backlog: 128 })).type.toBe<Promise<Record<string, unknown>>>();
  expect(buildFastifyOptions({ http2: true })).type.toBe<Promise<Record<string, unknown>>>();
  expect(cleanBasePath('api')).type.toBe<string>();
  expect(ensureTrailingSlash('/api')).type.toBe<string>();
  expect(ensureFileUrl('/tmp/file.js')).type.toBeAssignableTo<string | URL>();
  expect(ensureFileUrl(undefined)).type.toBe<undefined>();
  expect(importFile('/tmp/file.js')).type.toBe<Promise<unknown>>();
  expect(resolvePackageViaCJS('/path/to/root', '@platformatic/basic')).type.toBe<string>();
  expect(resolvePackageViaESM('/path/to/root', '@platformatic/basic')).type.toBe<Promise<string>>();
  expect(resolvePackage).type.toBe<typeof resolvePackageViaCJS>();
});

test('injectViaRequest export', () => {
  const injected = injectViaRequest('http://localhost', { method: 'GET', url: '/' });

  expect(injected).type.toBe<Promise<InjectViaRequestResponse | unknown | undefined>>();
});

test('worker exports', () => {
  expect(isWindows).type.toBe<boolean>();
  expect(generateChildrenId()).type.toBe<string>();
  expect(getSocketPath('worker-id')).type.toBe<string>();
  expect(createServerListener()).type.toBe<CancellablePromise<Server | null>>();
  expect(createChildProcessListener()).type.toBe<CancellablePromise<ChildProcess | null>>();
  expect(getServerUrl(server)).type.toBe<string>();
});

const childManager = new ChildManager({ context: { applicationId: 'test-app' } });

test('ChildManager class', () => {
  expect(childManager.listen()).type.toBe<Promise<void>>();
  expect(childManager.close()).type.toBe<Promise<void>>();
  expect(childManager.inject()).type.toBe<Promise<void>>();
  expect(childManager.eject()).type.toBe<Promise<void>>();
  expect(childManager.getSocketPath()).type.toBe<string>();
  expect(childManager.getClients()).type.toBe<Set<unknown>>();
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
