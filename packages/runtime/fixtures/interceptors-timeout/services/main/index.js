import { createServer } from 'node:http'

let server

const original = globalThis.platformatic.capability.getDispatchTarget
globalThis.platformatic.capability.getDispatchTarget = function () {}

export function create () {
  server = createServer()
  return server
}

export function close () {
  server.close()
}
