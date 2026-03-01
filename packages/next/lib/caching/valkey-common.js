import { buildPinoFormatters, buildPinoTimestamp } from '@platformatic/foundation'
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

globalThis.platformatic ??= {}
globalThis.platformatic.valkeyClients = new Map()

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
  let client = globalThis.platformatic.valkeyClients.get(url)

  if (!client) {
    client = new Redis(url, { enableAutoPipelining: true })
    globalThis.platformatic.valkeyClients.set(url, client)

    globalThis.platformatic.events.on('plt:next:close', () => {
      client.disconnect(false)
    })
  }

  return client
}

export function createPlatformaticLogger () {
  const loggerConfig = globalThis.platformatic?.config?.logger

  const pinoOptions = {
    ...loggerConfig,
    level: globalThis.platformatic?.logLevel ?? loggerConfig?.level ?? 'info'
  }
  if (pinoOptions.formatters) {
    pinoOptions.formatters = buildPinoFormatters(pinoOptions.formatters)
  }
  if (pinoOptions.timestamp) {
    pinoOptions.timestamp = buildPinoTimestamp(pinoOptions.timestamp)
  }

  if (globalThis.platformatic?.applicationId) {
    pinoOptions.name = `cache:${globalThis.platformatic.applicationId}`
  }

  if (pinoOptions.base !== null) {
    pinoOptions.base = {
      ...(pinoOptions.base ?? {}),
      pid: process.pid,
      hostname: hostname(),
      worker: globalThis.platformatic?.workerId
    }
  } else if (pinoOptions.base === null) {
    pinoOptions.base = undefined
  }

  return pino(pinoOptions)
}

export function getPlatformaticSubprefix () {
  const root = fileURLToPath(globalThis.platformatic.root)

  return existsSync(resolve(root, '.next/BUILD_ID'))
    ? readFileSync(resolve(root, '.next/BUILD_ID'), 'utf-8').trim()
    : 'development'
}

export function getPlatformaticMeta () {
  return {
    applicationId: globalThis.platformatic.applicationId,
    workerId: globalThis.platformatic.workerId
  }
}

export function serialize (data) {
  return msgpackr.pack(data).toString('base64url')
}

export function deserialize (data) {
  return msgpackr.unpack(Buffer.from(data, 'base64url'))
}
