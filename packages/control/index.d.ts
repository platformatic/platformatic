import { ChildProcess } from "node:child_process";
import BodyReadable from "undici/types/readable";
import { FastifyError } from "@fastify/error";
import { Readable } from "node:stream";
import { HttpHeader } from 'fastify/types/utils'
import WebSocket from "ws";

declare namespace control {
  class WebSocketStream extends Readable {
    constructor(url: string);
    ws: WebSocket;
  }

  interface Runtime {
    pid: number,
    cwd: string,
    argv: string[],
    uptimeSeconds: number,
    execPath: string,
    nodeVersion: string,
    projectDir: string,
    packageName: string | null,
    packageVersion: string | null,
    url: string | null,
    platformaticVersion: string
  }

  interface RuntimeServices {
    entrypoint: string,
    production: boolean,
    services: ({
      id: string;
      type: string;
      status: string;
      version: string;
      localUrl: string;
      entrypoint: boolean;
      url?: string;
      workers?: number;
      dependencies: {
        id: string;
        url: string;
        local: boolean;
      }[];
    } | {
      id: string;
      status: string;
    })[]
  }

  interface MetricValue {
    value: number,
    labels: {
      route?: string,
      quantile?: number,
      method?: string,
      status_code?: number,
      telemetry_id?: string,
      type?: string,
      space?: string,
      version?: string,
      major?: number,
      minor?: number,
      patch?: number,
      le?: number | string,
      kind?: string,
      serviceId: string,
      workerId?: number,
      dispatcher_stats_url?: string
    },
    metricName?: string,
    exemplar?: unknown
  }
  
  interface Metric {
    help: string,
    name: string,
    type: string,
    values: MetricValue[],
    aggregator: string
  }

  export class RuntimeApiClient {
    getMatchingRuntime(options?: { pid?: string; name?: string }): Promise<Runtime>;
    getRuntimes(): Promise<Runtime[]>;
    getRuntimeMetadata(pid: number): Promise<Runtime>;
    getRuntimeServices(pid: number): Promise<RuntimeServices>;
    getRuntimeConfig(pid: number): Promise<void>;
    getRuntimeServiceConfig(pid: number, serviceId?: string): Promise<void>;
    getRuntimeEnv(pid: number): Promise<void>;
    getRuntimeOpenapi(pid: number, serviceId: string): Promise<unknown>;
    getRuntimeServiceEnv(pid: number, serviceId: string): Promise<unknown>;
    reloadRuntime(pid: number, options?: object): Promise<ChildProcess>;
    restartRuntime(pid: number): Promise<void>;
    stopRuntime(pid: number): Promise<void>;
    getRuntimeMetrics<T extends { format?: "text" | "json" }>(
      pid: number,
      options?: T
    ): Promise<T extends { format: "text" } ? string : Metric[]>;
    getRuntimeLiveMetricsStream(pid: number): WebSocketStream;
    getRuntimeLiveLogsStream(
      pid: number,
      startLogIndex?: number
    ): WebSocketStream;
    getRuntimeLogsStream(
      pid: number,
      logsId: string,
      options?: { runtimePID?: number }
    ): Promise<BodyReadable>;
    getRuntimeAllLogsStream(
      pid: number,
      options?: { runtimePID?: number }
    ): Promise<BodyReadable>;
    getRuntimeLogIndexes(
      pid: number,
      options?: { all?: boolean }
    ): Promise<unknown>;
    injectRuntime(
      pid: number,
      serviceId: string,
      options: {
        url: string;
        method: string;
        headers: object;
        body: unknown;
      }
    ): Promise<{ headers: Record<string, HttpHeader>, statusCode: number, body: unknown }>;
    close(): Promise<void>;
  }

  export module errors {
    export const RuntimeNotFound: FastifyError;
    export const ServiceNotFound: FastifyError;
    export const MissingRequestURL: FastifyError;
    export const FailedToGetRuntimeMetadata: FastifyError;
    export const FailedToGetRuntimeServices: FastifyError;
    export const FailedToGetRuntimeEnv: FastifyError;
    export const FailedToGetRuntimeOpenapi: FastifyError;
    export const FailedToStreamRuntimeLogs: FastifyError;
    export const FailedToStopRuntime: FastifyError;
    export const FailedToReloadRuntime: FastifyError;
    export const FailedToGetRuntimeConfig: FastifyError;
    export const FailedToGetRuntimeServiceEnv: FastifyError;
    export const FailedToGetRuntimeServiceConfig: FastifyError;
    export const FailedToGetRuntimeHistoryLogs: FastifyError;
    export const FailedToGetRuntimeAllLogs: FastifyError;
    export const FailedToGetRuntimeLogIndexes: FastifyError;
    export const FailedToGetRuntimeMetrics: FastifyError;
  }
}

export = control;
