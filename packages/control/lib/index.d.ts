import { ChildProcess } from 'node:child_process'
import { Readable } from 'node:stream'
import { Dispatcher } from 'undici'
import WebSocket from 'ws'

export * from './errors.js'

export type ReadableBody = Dispatcher.ResponseData['body']

export class WebSocketStream extends Readable {
  constructor (url: string)
  ws: WebSocket
}

export interface RuntimeDependency {
  id: string
  url: string
  local: boolean
}

export interface RuntimeApplicationBase {
  id: string
  status: string
}

export interface RuntimeApplication {
  id: string
  type: string
  status: string
  version: string
  localUrl: string
  entrypoint: boolean
  url?: string
  workers?: number
  dependencies: Runtime
}

export interface Runtime {
  pid: number
  cwd: string
  argv: string[]
  uptimeSeconds: number
  execPath: string
  nodeVersion: string
  projectDir: string
  packageName: string | null
  packageVersion: string | null
  url: string | null
  platformaticVersion: string
  startTime?: number
}

export interface RuntimeApplications {
  entrypoint: string
  production: boolean
  applications: (RuntimeApplication | RuntimeApplicationBase)[]
}

export interface MetricValue {
  value: number
  labels: {
    route?: string
    quantile?: number
    method?: string
    status_code?: number
    telemetry_id?: string
    type?: string
    space?: string
    version?: string
    major?: number
    minor?: number
    patch?: number
    le?: number | string
    kind?: string
    applicationId: string
    workerId?: number
    dispatcher_stats_url?: string
  }
  metricName?: string
  exemplar?: unknown
}

export interface Metric {
  help: string
  name: string
  type: string
  values: MetricValue[]
  aggregator: string
}

export interface LogIndexes {
  pid: number
  indexes: number[]
}

export class RuntimeApiClient {
  getMatchingRuntime (options?: { pid?: string; name?: string }): Promise<Runtime>
  getRuntimes (): Promise<Runtime[]>
  getRuntimeMetadata (pid: number): Promise<Runtime>
  getRuntimeApplications (pid: number): Promise<RuntimeApplications>
  getRuntimeConfig (pid: number): Promise<Record<string, unknown> & { path?: string, configFile?: string, configPath?: string, server?: { path?: string } }>
  getRuntimeApplicationConfig (pid: number, applicationId?: string): Promise<Record<string, unknown>>
  getRuntimeEnv (pid: number): Promise<Record<string, string>>
  getRuntimeOpenapi (pid: number, applicationId: string): Promise<Record<string, unknown>>
  getRuntimeApplicationEnv (pid: number, applicationId: string): Promise<Record<string, string>>
  reloadRuntime (pid: number, options?: object): Promise<ChildProcess>
  restartRuntime (pid: number, options?: {gradual?: boolean}): Promise<void>
  stopRuntime (pid: number): Promise<void>
  getRuntimeMetrics<T extends { format?: 'text' | 'json' }> (
    pid: number,
    options?: T
  ): Promise<T extends { format: 'text' } ? string : Metric[]>
  getRuntimeLiveMetricsStream (pid: number): WebSocketStream
  getRuntimeLiveLogsStream (pid: number, startLogIndex?: number): WebSocketStream
  getRuntimeLogsStream (pid: number, logsId: string, options?: { runtimePID?: number }): Promise<ReadableBody>
  getRuntimeAllLogsStream (pid: number, options?: { runtimePID?: number }): Promise<ReadableBody>
  getRuntimeLogIndexes (pid: number, options?: { all?: boolean }): Promise<LogIndexes[]>
  injectRuntime (
    pid: number,
    applicationId: string,
    options: {
      url: string
      method: string
      headers?: Record<string, string>
      query?: Record<string, any>
      body?: any
    }
  ): Promise<Dispatcher.ResponseData>
  close (): Promise<void>
}
