import { createServer } from 'node:http'

let server

globalThis.platformatic.capability.getDispatchTarget = function () {
  return null
}

export function create () {
  server = createServer()
  return server
}

export function close () {
  server.close()
}
