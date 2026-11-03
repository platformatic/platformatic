import { PassThrough } from 'node:stream'
import { kGatewayProxyResponseConsumer } from '../../../index.js'

export const states = new Map()
export const prefix = '<!doctype html>'

export function handler (request, reply, dest, options) {
  const state = states.get(request.server.listeningOrigin)
  state.inner++
  return reply.from(dest, options)
}

export function wrappingHandler (previous, send) {
  return (request, reply, dest, options) => {
    const state = states.get(request.server.listeningOrigin)
    state.outer++
    if (request.headers['x-bypass']) {
      return previous(request, reply, dest, options)
    }

    const output = new PassThrough()
    let source
    reply[kGatewayProxyResponseConsumer] = {
      onResponse (response) {
        state.responses.push({ client: request.headers['x-client'], headers: { ...response.headers } })
        source = response.stream
        source.on('error', error => output.destroy(error))
        if (reply.raw.destroyed || reply.raw.writableFinished) {
          source.destroy()
          return
        }
        source.pipe(output)
      }
    }
    reply.raw.once('close', () => {
      source?.destroy()
      output.destroy()
    })

    reply.type('text/html')
    send(request, reply, output)
    output.write(prefix)
    const wrapped = {
      ...options,
      rewriteRequestHeaders: (req, headers) => ({
        ...options.rewriteRequestHeaders(req, headers),
        'accept-encoding': 'identity'
      }),
      onError (rep, context) {
        state.errors++
        options.onError(rep, context)
        output.destroy(context.error)
      }
    }
    Promise.resolve(previous(request, reply, dest, wrapped)).catch(error => output.destroy(error))
    return reply
  }
}
