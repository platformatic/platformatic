import { EventEmitter } from 'node:events'

export const events = new EventEmitter()

export function handler ({ next }, request, reply, destination, options) {
  events.emit('request', request.headers['x-client'])
  reply.header('x-wrapper-request', request.headers['x-override'])
  if (request.headers['x-early']) {
    return reply.send('early')
  }
  return next(request, reply, destination, options)
}
