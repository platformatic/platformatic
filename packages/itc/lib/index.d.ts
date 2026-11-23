import type { Context } from '@opentelemetry/api'
import { EventEmitter } from 'node:events'
import { MessagePort } from 'node:worker_threads'

export type Handler = (data: any) => any | Promise<any>

export interface ITCConstructorOptions {
  port: MessagePort,
  name: string,
  handlers?: Record<string, Handler>
  throwOnMissingHandler?: boolean
}

export interface ITCSendOptions extends Record<string, any> {
  signal?: AbortSignal
  /** Milliseconds to wait for the response before failing with a PLT_ITC_REQUEST_TIMEOUT error. */
  timeout?: number
  /** Set to `false` when the message is only cloneable values, to post it without sanitizing it. */
  sanitize?: boolean
}

export interface ITCHandlerOptions {
  /**
   * Set to `false` when the handler returns only cloneable data, to post its results without sanitizing them.
   * Errors are always sanitized.
   */
  sanitize?: boolean
}

export interface OutgoingMessagingSpanOptions {
  telemetryContext?: Context
  telemetryMetadata?: Record<string, string>
}

export interface OutgoingMessagingSpan {
  meta: {
    mode: string
    sourceApplication?: string
    targetApplication?: string
    telemetry: Record<string, string>
  } | null
  run<T>(callback: () => T): T
  end(error?: Error | null): void
}

export class ITC extends EventEmitter {
  constructor (options: ITCConstructorOptions)

  send (name: string, message: any, options?: ITCSendOptions): Promise<any>
  notify (name: string, message: any, options?: Record<string, any>): void
  process (name: string, message: any, context?: Record<string, any>): Promise<any>
  handle (message: string, handler: Handler, options?: ITCHandlerOptions): void
  getHandler (message: string): Handler | undefined
  listen (): void
  close (): void
}

export function initializeITCTelemetry (): Promise<any>

export function startOutgoingMessagingSpan (
  mode: string,
  sourceApplication: string,
  targetApplication: string,
  messageName: string,
  options?: OutgoingMessagingSpanOptions
): OutgoingMessagingSpan | null

export function startOutgoingMessagingSpanSync (
  mode: string,
  sourceApplication: string,
  targetApplication: string,
  messageName: string,
  options?: OutgoingMessagingSpanOptions
): OutgoingMessagingSpan | null

export function traceIncomingMessagingHandler (
  applicationId: string,
  messageName: string,
  handler: Handler,
  data: any,
  handlerContext?: Record<string, any>
): any
