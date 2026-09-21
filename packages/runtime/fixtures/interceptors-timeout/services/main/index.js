import { getCapability } from '@platformatic/globals'
import { createServer } from 'node:http'

let server

const capability = getCapability()
capability.getDispatchTarget = function () {
  return null
}

export function create () {
  server = createServer()
  return server
}

export function close () {
  server.close()
}
