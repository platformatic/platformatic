import { EventEmitter } from "node:events";

export class Bus extends EventEmitter {
  constructor(id: string);

  close: () => void;

  send: (destination: string, type: string, data?: any) => void;
  broadcast: (destination: string, type: string, data?: any) => void;
}
