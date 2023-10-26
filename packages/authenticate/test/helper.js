import { randomUUID } from 'node:crypto'
import fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'

export async function createAuthProxy (t, opts = {}) {
  const app = fastify()

  app.register(fastifyWebsocket)
  app.decorate('waitingRequests', new Map())

  app.register(async function (fastify) {
    fastify.get('/user-api-key', { websocket: true }, async (connection) => {
      const reqId = randomUUID().replace(/-/g, '')
      fastify.log.debug({ reqId }, 'Connection established.')

      connection.socket.on('message', message => {
        try {
          message = JSON.parse(message.toString())
        } catch (err) {
          fastify.log.error({ reqId, err }, 'Failed to parse message.')
          connection.socket.close()
          return
        }

        if (message.type === 'CREATE_USER_API_KEY') {
          if (opts.onReqId) opts.onReqId(reqId)
          const responseMessage = {
            type: 'CREATE_USER_API_KEY_REQ_ID',
            data: { reqId }
          }
          fastify.waitingRequests.set(reqId, connection)
          connection.socket.send(JSON.stringify(responseMessage))

          fastify.inject({
            method: 'PUT',
            url: '/user-api-key',
            payload: { reqId, key: randomUUID().replace(/-/g, '') }
          })
          return
        }

        connection.socket.close()
        throw new Error(`Unknown message type "${message.type}".`)
      })

      connection.socket.on('error', err => {
        fastify.log.error({ reqId, err }, 'Connection error.')
        connection.socket.close()
      })

      connection.socket.on('close', () => {
        fastify.log.debug({ reqId }, 'Connection closed.')
        fastify.waitingRequests.delete(reqId)
      })
    })

    fastify.put('/user-api-key', async (request, reply) => {
      const { reqId, key } = request.body
      const connection = fastify.waitingRequests.get(reqId)
      if (!connection) {
        reply.code(404)
        return { error: 'Connection not found.' }
      }

      if (opts.onUserApiKey) opts.onUserApiKey(key)

      const responseMessage = {
        type: 'CREATE_USER_API_KEY_RESULT',
        data: { userApiKey: key }
      }
      connection.socket.send(JSON.stringify(responseMessage))
      connection.socket.close()
    })
  })
  await app.listen({ port: 0 })
  t.after(async () => {
    await app.close()
  })

  return app
}

export default { createAuthProxy }
