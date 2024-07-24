import { EventEmitter } from 'node:events';
import { MessagePort } from 'node:worker_threads'

export interface ITCConstructorOptions {
  port: MessagePort;
}

export class ITC extends EventEmitter {
  constructor(options: ITCConstructorOptions);

  send(name: string, message: any): Promise<any>;
  handle(message: string, handler: (data: any) => Promise<any>): void;
  listen(): void;
  close(): void;
}


declare module "@platformatic/itc" {
  export { ITC };
}
