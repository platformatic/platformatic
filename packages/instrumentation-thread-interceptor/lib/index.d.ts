import { InstrumentationBase, type InstrumentationConfig } from '@opentelemetry/instrumentation'

export interface ThreadInterceptorHooks {
  onRequest: (request: object, clientContext: object) => void
  onResponseEnd: (request: object, response: object | null, clientContext: object) => void
  onError: (request: object, response: object | null, clientContext: object, error: Error) => void
}

export declare function createThreadInterceptorHooks (): ThreadInterceptorHooks

export declare class ThreadInterceptorInstrumentation extends InstrumentationBase {
  constructor (config?: InstrumentationConfig)
  protected init (): ReturnType<InstrumentationBase['init']>
  createHooks (): ThreadInterceptorHooks
}

export default ThreadInterceptorInstrumentation
