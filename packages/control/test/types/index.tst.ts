import { FastifyError } from '@fastify/error';
import { expect, test } from 'tstyche';
import {
  FailedToGetRuntimeAllLogs,
  FailedToGetRuntimeConfig,
  FailedToGetRuntimeEnv,
  FailedToGetRuntimeHistoryLogs,
  FailedToGetRuntimeOpenapi
} from '../../lib/errors.js';
import type {
  Metric,
  ReadableBody,
  Runtime,
  RuntimeApplications
} from '../../lib/index.js';
import { RuntimeApiClient } from '../../lib/index.js';

// RuntimeApiClient
const runtime = {} as Runtime;
const application = {} as RuntimeApplications;
const metric = {} as Metric;
const api = new RuntimeApiClient();

test('RuntimeApiClient methods', () => {
  expect(api.getMatchingRuntime()).type.toBe<Promise<Runtime>>();
  expect(api.getRuntimeMetrics(runtime.pid)).type.toBe<Promise<Metric[]>>();
  expect(api.getRuntimeMetrics(runtime.pid, {})).type.toBe<Promise<Metric[]>>();
  expect(api.getRuntimeMetrics(runtime.pid, { format: 'json' })).type.toBe<
    Promise<Metric[]>
  >();
  expect(api.getRuntimeMetrics(runtime.pid, { format: 'text' })).type.toBe<
    Promise<string>
  >();
  expect(api.getRuntimes()).type.toBe<Promise<Runtime[]>>();
});

async function unused() {
  const result = await api.injectRuntime(0, '', {
    body: {},
    headers: {},
    method: 'PUT',
    url: '/foo'
  });

  test('injectRuntime result', () => {
    expect(result.body).type.toBe<ReadableBody>();
    expect(result.statusCode).type.toBe<number>();
    expect(result.headers).type.toBeAssignableTo<Record<string, unknown>>();
  });

  return result;
}

const application1 = application.applications[0]!;

test('RuntimeApiClient / RuntimeApplications types', () => {
  expect(api.getRuntimeOpenapi(runtime.pid, application1.id)).type.toBe<
    Promise<Record<string, unknown>>
  >();
  expect(runtime.argv).type.toBe<string[]>();
  expect(runtime.uptimeSeconds).type.toBe<number>();
  expect(runtime.packageVersion).type.toBe<string | null>();
  expect(runtime.urls).type.toBe<Record<string, string>>();
  expect(api.getRuntimeApplications(45)).type.toBe<
    Promise<{
      production: boolean;
      applications: RuntimeApplications['applications'];
    }>
  >();
  expect(application1.id).type.toBe<string>();
  expect(application1.status).type.toBe<string>();
});

if ('url' in application1) {
  test('application1 url/workers', () => {
    expect(application1.url).type.toBe<string | null>();
    expect(application1.urls).type.toBe<string[]>();
    expect(application1.dependencies).type.toBe<string[]>();
    expect(application1.workers).type.toBe<number | undefined>();
  });
}

test('Metric type', () => {
  const metricValue = metric.values[0]!;

  expect(metric.aggregator).type.toBe<string>();
  expect(metricValue.labels.applicationId).type.toBe<string>();
  expect(metricValue.labels?.quantile).type.toBe<number | undefined>();
  expect(metricValue.labels?.route).type.toBe<string | undefined>();
  expect(metricValue.labels?.method).type.toBe<string | undefined>();
  expect(metricValue.labels?.status_code).type.toBe<
    number | string | undefined
  >();
  expect(metricValue.labels?.telemetry_id).type.toBe<string | undefined>();
  expect(metricValue.labels?.workerId).type.toBe<number | undefined>();
  expect(metricValue.labels?.dispatcher_stats_url).type.toBe<
    string | undefined
  >();
  expect(metricValue.labels?.error_type).type.toBe<string | undefined>();
  expect(metricValue.metricName).type.toBe<string | undefined>();
  expect(metricValue.exemplar).type.toBe<unknown | undefined>();
  expect(api.close()).type.toBe<Promise<void>>();
});

// errors
test('error factories', () => {
  expect(FailedToGetRuntimeAllLogs).type.toBe<(arg: string) => FastifyError>();
  expect(FailedToGetRuntimeConfig).type.toBe<(arg: string) => FastifyError>();
  expect(FailedToGetRuntimeEnv).type.toBe<(arg: string) => FastifyError>();
  expect(FailedToGetRuntimeOpenapi).type.toBe<(arg: string) => FastifyError>();
  expect(FailedToGetRuntimeHistoryLogs).type.toBe<
    (arg: string) => FastifyError
  >();

  expect(FailedToGetRuntimeHistoryLogs).type.not.toBeAssignableTo<string>();
  expect(FailedToGetRuntimeHistoryLogs).type.not.toBeAssignableTo<number>();
});
