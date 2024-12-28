import { ChildProcess } from "node:child_process";
import BodyReadable from "undici/types/readable";
import { FastifyError } from "@fastify/error";
import { Readable } from "node:stream";
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

  interface Services {
    entrypoint: string,
    production: boolean,
    services: ({
      id: string;
      type: string;
      status: string;
      version: string;
      localUrl: string;
      entrypoint: boolean;
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

  export class RuntimeApiClient {
    getMatchingRuntime(opts: { pid?: string; name?: string }): Promise<Runtime>;
    getRuntimes(): Promise<Runtime[]>;
    getRuntimeMetadata(pid: number): Promise<Runtime>;
    getRuntimeServices(pid: number): Promise<Services>;
    getRuntimeConfig(pid: number): Promise<void>;
    getRuntimeServiceConfig(pid: number, serviceId?: string): Promise<void>;
    getRuntimeEnv(pid: number): Promise<void>;
    getRuntimeServiceEnv(pid: number, serviceId: string): Promise<unknown>;
    reloadRuntime(pid: number, options?: object): Promise<ChildProcess>;
    restartRuntime(pid: number): Promise<void>;
    stopRuntime(pid: number): Promise<void>;
    getRuntimeMetrics(
      pid: number,
      options?: { format?: "text" | "json" }
    ): Promise<unknown>;
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
    ): Promise<unknown>;
    close(): Promise<void>;
  }

  export module errors {
    export const RuntimeNotFound: FastifyError;
    export const ServiceNotFound: FastifyError;
    export const MissingRequestURL: FastifyError;
    export const FailedToGetRuntimeMetadata: FastifyError;
    export const FailedToGetRuntimeServices: FastifyError;
    export const FailedToGetRuntimeEnv: FastifyError;
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
