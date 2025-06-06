import { generateRequest, sanitize } from '@platformatic/itc'
import { ensureLoggableError } from '@platformatic/utils'
import { once } from 'node:events'
import { platform } from 'node:os'
import { workerData } from 'node:worker_threads'
import build from 'pino-abstract-transport'
import { WebSocket } from 'ws'
import { getSocketPath } from './child-manager.js'

/* c8 ignore next 5 */
function logDirectError (message, error) {
  process._rawDebug(`Logger thread for child process of service ${workerData.id} ${message}.`, {
    error: ensureLoggableError(error)
  })
}

/* c8 ignore next 4 */
function handleUnhandled (type, error) {
  logDirectError(`threw an ${type}`, error)
  process.exit(6)
}

process.on('uncaughtException', handleUnhandled.bind(null, 'uncaught exception'))
process.on('unhandledRejection', handleUnhandled.bind(null, 'unhandled rejection'))

export default async function () {
  try {
    /* c8 ignore next */
    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    const socket = new WebSocket(`${protocol}${getSocketPath(process.env.PLT_MANAGER_ID)}`)

    await once(socket, 'open')

    // Do not process responses but empty the socket inbound queue
    socket.on('message', () => {})

    /* c8 ignore next 3 */
    socket.on('error', error => {
      logDirectError('threw a socket error', error)
    })

    return build(
      async function (source) {
        for await (const obj of source) {
          socket.send(JSON.stringify(sanitize(generateRequest('log', { logs: [obj] }))))
        }
      },
      {
        close (_, cb) {
          socket.close()
          cb()
        }
      }
    )
    /* c8 ignore next 3 */
  } catch (error) {
    logDirectError('threw a connection error', error)
  }
}
