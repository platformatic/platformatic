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
import { readFile } from 'node:fs/promises'
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
    const { Packr } = require('msgpackr')
    // A fresh Packr instance (unlike msgpackr's default pack/unpack singleton, which hardcodes
    // useRecords: false) uses the record extension for plain objects, which keeps them
    // distinguishable on the wire from Map instances, preserving Map identity round-trip.
    // moreTypes additionally preserves Set/RegExp/Error, should they ever appear in cache data.
    msgpackr = new Packr({ moreTypes: true })
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

// Maps each "use cache" function ID to the file defining it, relative to the application.
export async function loadCacheFunctionsFiles () {
  const nextDir = resolve(fileURLToPath(getRoot()), '.next')
  const files = new Map()

  const [manifest, serverFiles] = await Promise.all([
    readJSON(resolve(nextDir, 'server/server-reference-manifest.json')),
    readJSON(resolve(nextDir, 'required-server-files.json'))
  ])

  if (!manifest || !serverFiles) {
    return files
  }

  // Turbopack reports files relative to the workspace root, which can contain the application
  const appPrefix = serverFiles.relativeAppDir ? serverFiles.relativeAppDir + '/' : ''

  for (const [id, { filename }] of Object.entries(manifest.node ?? {})) {
    if (filename) {
      files.set(id, filename.startsWith(appPrefix) ? filename.slice(appPrefix.length) : filename)
    }
  }

  return files
}

// Returns null when the file does not exist, like in development.
async function readJSON (path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'))
  } catch (e) {
    if (e.code === 'ENOENT') {
      return null
    }
    throw e
  }
}

// The cache key is the React-encoded list of the function ID, its arguments and other parts.
// The ID, a 42 characters hexadecimal string, is the first one of its kind in the key.
export function getCacheFunctionId (cacheKey) {
  return cacheKey.match(/"([0-9a-f]{42})"/)?.[1]
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
