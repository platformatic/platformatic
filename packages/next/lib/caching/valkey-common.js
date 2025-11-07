import { buildPinoFormatters, buildPinoTimestamp } from '@platformatic/foundation'
import { Redis } from 'iovalkey'
import { pack, unpack } from 'msgpackr'
import { existsSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'

const clients = new Map()

export function keyFor (prefix, subprefix, section, key) {
  return [prefix, 'cache:next', subprefix, section, key ? Buffer.from(key).toString('base64url') : undefined]
    .filter(c => c)
    .join(':')
}

export function getConnection (url) {
  let client = clients.get(url)

  if (!client) {
    client = new Redis(url, { enableAutoPipelining: true })
    clients.set(url, client)

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
  return pack(data).toString('base64url')
}

export function deserialize (data) {
  return unpack(Buffer.from(data, 'base64url'))
}
