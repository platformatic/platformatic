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
    level: getLogLevel({ throwOnMissing: false }) ?? loggerConfig?.level ?? 'info'
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

// msgpackr has no wire-level distinction between a plain object and a Map (both encode
// as the same msgpack "map" type), and it packs Map instances natively before any custom
// extension is consulted. Next.js cache entries can carry Map fields (e.g. segmentData for
// Cache Components / "use cache" pages), so we tag Map instances before packing and restore
// them after unpacking to round-trip them without affecting plain objects elsewhere.
const MAP_TYPE_TAG = 'Map'

function markMaps (value) {
  if (value instanceof Map) {
    const entries = []
    for (const [key, entryValue] of value) {
      entries.push([markMaps(key), markMaps(entryValue)])
    }
    return { __type: MAP_TYPE_TAG, entries }
  }

  if (Array.isArray(value)) {
    return value.map(markMaps)
  }

  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    const result = {}
    for (const key of Object.keys(value)) {
      result[key] = markMaps(value[key])
    }
    return result
  }

  return value
}

function unmarkMaps (value) {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(unmarkMaps)
    }

    if (value.constructor === Object) {
      if (value.__type === MAP_TYPE_TAG) {
        return new Map(value.entries.map(([key, entryValue]) => [unmarkMaps(key), unmarkMaps(entryValue)]))
      }

      const result = {}
      for (const key of Object.keys(value)) {
        result[key] = unmarkMaps(value[key])
      }
      return result
    }
  }

  return value
}

export function serialize (data) {
  return msgpackr.pack(markMaps(data)).toString('base64url')
}

export function deserialize (data) {
  return unmarkMaps(msgpackr.unpack(Buffer.from(data, 'base64url')))
}
