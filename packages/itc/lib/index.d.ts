import { EventEmitter } from 'node:events'
import { MessagePort } from 'node:worker_threads'

export type Handler = ((data: any) => any) | ((data: any) => Promise<any>)

export interface ITCConstructorOptions {
  port: MessagePort
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

declare module '@platformatic/itc' {
  export { ITC }
}
