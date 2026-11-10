export interface WorkflowSDKRemoteRuntime {
  readRemoteHandlerManifest: (path: string) => Promise<Record<string, unknown>>
  readRemoteManifest?: (path: string) => Promise<Record<string, unknown>>
  createRemoteHandlerTransport: (options: Record<string, unknown>) => unknown
  registerRemoteHandlerRuntime: (options: Record<string, unknown>) => Promise<{ close?: () => Promise<void> }>
}

export interface WorkflowSDKHandlerTransport {
  announceHandler: () => Promise<void>
  claim: (capacity: number) => Promise<unknown[]>
  heartbeat: (tokens: string[]) => Promise<void>
  reportStarted: (input: { token: string, handlerRunId: string }) => Promise<void>
  reportResult: (input: { token: string, outcome: unknown }) => Promise<void>
  reconcileHandlerRuns?: (runs: Array<{ operationKey: string, handlerRunId: string }>) => Promise<unknown[]>
  close?: () => Promise<void>
}

export interface WorkflowSDKControlPlane {
  registerManifest: (input: {
    identity: WorkflowSDKHandlerIdentity & { manifestHash: string }
    manifest: Record<string, unknown>
  }) => Promise<unknown>
  createHandlerTransport: (input: {
    identity: WorkflowSDKHandlerIdentity & { manifestHash: string }
    manifest: Record<string, unknown>
    publicManifest: Record<string, unknown>
    remoteRuntime: WorkflowSDKRemoteRuntime
    reconciliation?: boolean
  }) => WorkflowSDKHandlerTransport | Promise<WorkflowSDKHandlerTransport>
}

export interface WorkflowSDKHandlerIdentity {
  tenant?: string
  service: string
  versionLabel: string
}

export interface LocalRemoteHandlerControlPlane extends WorkflowSDKControlPlane {
  dispatch: (input: {
    identity: WorkflowSDKHandlerIdentity
    endpoint: string
    payload: unknown
    budget?: number
  }) => Promise<unknown>
  getHandler: (identity: WorkflowSDKHandlerIdentity) => Record<string, unknown> | undefined
  close: () => Promise<void>
}

export interface WorkflowSDKCapabilityOptions {
  /** Application root used to resolve the private handler manifest and Workflow SDK. */
  root: string
  /** Handler identity. Tenant is optional for local/self-managed control planes. */
  identity?: WorkflowSDKHandlerIdentity
  /** Host-provided registry and handler transport implementation. */
  controlPlane?: WorkflowSDKControlPlane
  /** Optional runtime adapter, primarily useful for custom hosts and tests. */
  remoteRuntime?: WorkflowSDKRemoteRuntime
  /** Private manifest path, relative to root unless absolute. */
  manifestPath?: string
  /** Maximum number of concurrently running remote handler workflows. */
  capacity?: number
  /** Claim heartbeat interval in milliseconds. */
  heartbeatIntervalMs?: number
  /** Enable active handler-run reconciliation when supported by the protocol. */
  reconciliation?: boolean
  /** Logger compatible with the methods used by Platformatic runtimes. */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>
}

export interface WorkflowSDKCapabilityStatus {
  state: 'idle' | 'starting' | 'started' | 'disabled' | 'stopped' | 'failed'
  reason?: 'control-plane-unavailable' | 'identity-unavailable' | 'manifest-unavailable' | 'transport-unavailable'
  manifestPath?: string
}

export declare class WorkflowSDKCapability {
  constructor (options: WorkflowSDKCapabilityOptions)
  readonly status: WorkflowSDKCapabilityStatus
  start (): Promise<WorkflowSDKCapabilityStatus>
  stop (): Promise<void>
  close (): Promise<void>
  setControlPlane (controlPlane?: WorkflowSDKControlPlane): Promise<WorkflowSDKCapabilityStatus>
}

export declare function createWorkflowSDKCapability (
  options: WorkflowSDKCapabilityOptions
): WorkflowSDKCapability

export declare function loadRemoteRuntime (root: string): Promise<WorkflowSDKRemoteRuntime>

export declare function loadRemoteManifest (root: string): Promise<Record<string, unknown>>

export declare function createLocalRemoteHandlerControlPlane (
  options?: { maxQueueSize?: number }
): LocalRemoteHandlerControlPlane

export declare const DEFAULT_REMOTE_HANDLER_MANIFEST_PATH: '.well-known/workflow/v1/remote-handlers.json'
export declare const DEFAULT_REMOTE_MANIFEST_PATH: '.well-known/workflow/v1/remote-manifest.json'
