import { FastifyError } from '@fastify/error'

export declare const ERROR_PREFIX: string

export declare const RuntimeNotFound: (value: string) => FastifyError
export declare const ServiceNotFound: (value: string) => FastifyError
export declare const MissingRequestURL: (value: string) => FastifyError
export declare const FailedToGetRuntimeMetadata: (value: string) => FastifyError
export declare const FailedToGetRuntimeServices: (value: string) => FastifyError
export declare const FailedToGetRuntimeEnv: (value: string) => FastifyError
export declare const FailedToGetRuntimeOpenapi: (value: string) => FastifyError
export declare const FailedToStreamRuntimeLogs: (value: string) => FastifyError
export declare const FailedToStopRuntime: (value: string) => FastifyError
export declare const FailedToReloadRuntime: (value: string) => FastifyError
export declare const FailedToGetRuntimeConfig: (value: string) => FastifyError
export declare const FailedToGetRuntimeServiceEnv: (value: string) => FastifyError
export declare const FailedToGetRuntimeServiceConfig: (value: string) => FastifyError
export declare const FailedToGetRuntimeHistoryLogs: (value: string) => FastifyError
export declare const FailedToGetRuntimeAllLogs: (value: string) => FastifyError
export declare const FailedToGetRuntimeLogIndexes: (value: string) => FastifyError
export declare const FailedToGetRuntimeMetrics: (value: string) => FastifyError
