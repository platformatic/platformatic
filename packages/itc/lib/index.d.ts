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

  send (name: string, message: any, options?: Record<string, any>): Promise<any>
  notify (name: string, message: any, options?: Record<string, any>): void
  handle (message: string, handler: Handler): void
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
