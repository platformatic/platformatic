import { FastifyError } from '@fastify/error'

export declare const ERROR_PREFIX: string

export declare const RuntimeNotFound: (value: string) => FastifyError
export declare const ApplicationNotFound: (value: string) => FastifyError
export declare const MissingRequestURL: (value: string) => FastifyError
export declare const FailedToGetRuntimeMetadata: (value: string) => FastifyError
export declare const FailedToGetRuntimeApplications: (value: string) => FastifyError
export declare const FailedToGetRuntimeEnv: (value: string) => FastifyError
export declare const FailedToGetRuntimeOpenapi: (value: string) => FastifyError
export declare const FailedToStreamRuntimeLogs: (value: string) => FastifyError
export declare const FailedToStopRuntime: (value: string) => FastifyError
export declare const FailedToReloadRuntime: (value: string) => FastifyError
export declare const FailedToGetRuntimeConfig: (value: string) => FastifyError
export declare const FailedToGetRuntimeApplicationEnv: (value: string) => FastifyError
export declare const FailedToGetRuntimeApplicationConfig: (value: string) => FastifyError
export declare const FailedToGetRuntimeHistoryLogs: (value: string) => FastifyError
export declare const FailedToGetRuntimeAllLogs: (value: string) => FastifyError
export declare const FailedToGetRuntimeLogIndexes: (value: string) => FastifyError
export declare const FailedToGetRuntimeMetrics: (value: string) => FastifyError
export declare const FailedToStartProfiling: (value: string) => FastifyError
export declare const FailedToStopProfiling: (value: string) => FastifyError
export declare const FailedToAddApplications: (value: string) => FastifyError
export declare const FailedToRemoveApplications: (value: string) => FastifyError
