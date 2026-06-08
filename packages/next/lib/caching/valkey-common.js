import { buildPinoFormatters, buildPinoTimestamp } from '@platformatic/foundation'
import {
  getApplicationId,
  getConfig,
  getEvents,
  getLogLevel,
  getRoot,
  getValkeyClients,
  getWorkerId,
  updateGlobals
} from '@platformatic/globals'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'

// commonjs require is superior because it allows lazy loading
const require = createRequire(import.meta.url)

let Redis
let msgpackr

updateGlobals({ valkeyClients: new Map() })

export function keyFor (prefix, subprefix, section, key) {
  let result = prefix?.length ? prefix + ':' : ''

  result += 'cache:next'

  if (subprefix?.length) {
    result += ':' + subprefix
  }

  if (section?.length) {
    result += ':' + section
  }

  if (key?.length) {
    result += ':' + Buffer.from(key).toString('base64url')
  }

  return result
}

export function ensureRedis () {
  if (!Redis) {
    Redis = require('iovalkey').Redis
  }
}

export function ensureMsgpackr () {
  if (!msgpackr) {
    msgpackr = require('msgpackr')
  }
}

export function getConnection (url) {
  const valkeyClients = getValkeyClients()
  let client = valkeyClients.get(url)

  if (!client) {
    client = new Redis(url, { enableAutoPipelining: true })
    valkeyClients.set(url, client)

    const events = getEvents()
    events.on('plt:next:close', () => {
      client.disconnect(false)
    })
  }

  return client
}

export function createPlatformaticLogger () {
  const config = getConfig()
  const loggerConfig = config.logger

  const pinoOptions = {
    ...loggerConfig,
    level: getLogLevel(false) ?? loggerConfig?.level ?? 'info'
  }
  if (pinoOptions.formatters) {
    pinoOptions.formatters = buildPinoFormatters(pinoOptions.formatters)
  }
  if (pinoOptions.timestamp) {
    pinoOptions.timestamp = buildPinoTimestamp(pinoOptions.timestamp)
  }

  const applicationId = getApplicationId()
  if (applicationId) {
    pinoOptions.name = `cache:${applicationId}`
  }

  if (pinoOptions.base !== null) {
    pinoOptions.base = {
      ...(pinoOptions.base ?? {}),
      pid: process.pid,
      hostname: hostname(),
      worker: getWorkerId()
    }
  } else if (pinoOptions.base === null) {
    pinoOptions.base = undefined
  }

  return pino(pinoOptions)
}

export function getPlatformaticSubprefix () {
  const root = fileURLToPath(getRoot())

  return existsSync(resolve(root, '.next/BUILD_ID'))
    ? readFileSync(resolve(root, '.next/BUILD_ID'), 'utf-8').trim()
    : 'development'
}

export function getPlatformaticMeta () {
  return {
    applicationId: getApplicationId(),
    workerId: getWorkerId()
  }
}

export function serialize (data) {
  return msgpackr.pack(data).toString('base64url')
}

export function deserialize (data) {
  return msgpackr.unpack(Buffer.from(data, 'base64url'))
}
