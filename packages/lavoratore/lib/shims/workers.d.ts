export interface ExecutionContext {
  props: Record<string, unknown>
  waitUntil (promise: Promise<unknown>): void
  passThroughOnException (): void
}

export declare const env: Record<string, unknown>
export declare function waitUntil (promise: Promise<unknown>): void
export declare function drainWaitUntil (): Promise<PromiseSettledResult<unknown>[]>
export declare function createExecutionContext (): ExecutionContext

export declare class RpcTarget {}

export declare class WorkerEntrypoint<Env = Record<string, unknown>> extends RpcTarget {
  constructor (ctx: ExecutionContext, env: Env)
  ctx: ExecutionContext
  env: Env
}

export declare class DurableObject<Env = Record<string, unknown>> extends RpcTarget {
  constructor (ctx: unknown, env: Env)
  ctx: unknown
  env: Env
}

export declare class WorkflowEntrypoint<Env = Record<string, unknown>> extends RpcTarget {
  constructor (ctx: ExecutionContext, env: Env)
  ctx: ExecutionContext
  env: Env
}
