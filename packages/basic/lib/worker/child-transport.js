import { generateRequest } from '@platformatic/itc'
import { errors } from '@platformatic/utils'
import { once } from 'node:events'
import { platform } from 'node:os'
import { workerData } from 'node:worker_threads'
import build from 'pino-abstract-transport'
import { WebSocket } from 'ws'
import { getSocketPath } from './child-manager.js'

function logDirectError (message, error) {
  process._rawDebug(`Logger thread for child process of service ${workerData.id} ${message}.`, {
    error: errors.ensureLoggableError(error)
  })
}

function handleUnhandled (type, error) {
  logDirectError(`threw an ${type}`, error)
  process.exit(6)
}

process.on('uncaughtException', handleUnhandled.bind(null, 'uncaught exception'))
process.on('unhandledRejection', handleUnhandled.bind(null, 'unhandled rejection'))

export default async function (opts) {
  try {
    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    const socket = new WebSocket(`${protocol}${getSocketPath(process.env.PLT_MANAGER_ID)}`)

    await once(socket, 'open')

    socket.on('error', error => {
      logDirectError('threw a socket error', error)
    })

    return build(async function (source) {
      for await (const obj of source) {
        socket.send(JSON.stringify(generateRequest('log', { logs: [obj] })))
      }
    })
  } catch (error) {
    logDirectError('threw a connection error', error)
  }
}
