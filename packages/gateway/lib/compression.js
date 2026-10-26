import fastifyCompress from '@fastify/compress'
import { isEnabled } from '@platformatic/foundation'
import { constants } from 'node:zlib'

const defaultEncodings = ['br', 'gzip']
const defaultBrotliQuality = 4
const defaultGzipLevel = 6
const defaultThreshold = 1024

// The same types @fastify/compress compresses by default. The gateway checks them itself
// to decide whether a response varies on Accept-Encoding, so the two must agree.
const compressibleTypes =
  /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)/u

const noTransform = /(?:^|,)\s*no-transform\s*(?:,|$)/i

function compilePattern (pattern) {
  const source = pattern
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')

  return new RegExp(`^${source}$`)
}

// `gateway.compression`: off when unset, else a boolean or a string, or an object with an `enabled`,
// each resolved as the runtime resolves the `enabled` of an application.
export function resolveCompression (compression, environment) {
  if (typeof compression === 'undefined') {
    return null
  }

  const options = typeof compression === 'object' && compression !== null ? compression : { enabled: compression }

  if (!isEnabled(options.enabled, environment)) {
    return null
  }

  return {
    encodings: options.encodings ?? defaultEncodings,
    brotliQuality: options.brotli?.quality ?? defaultBrotliQuality,
    gzipLevel: options.gzip?.level ?? defaultGzipLevel,
    threshold: options.threshold ?? defaultThreshold,
    exclude: (options.exclude ?? []).map(compilePattern)
  }
}

// Registered with `global: false`, so that @fastify/compress only decorates `reply.compress`:
// the gateway calls it on the responses it decides to compress.
export async function registerCompression (app, compression) {
  await app.register(fastifyCompress, {
    global: false,
    encodings: compression.encodings,
    threshold: compression.threshold,
    customTypes: compressibleTypes,
    brotliOptions: {
      params: { [constants.BROTLI_PARAM_QUALITY]: compression.brotliQuality }
    },
    zlibOptions: { level: compression.gzipLevel }
  })
}

function isCompressible (request, reply, compression) {
  if (request.method === 'HEAD') {
    return false
  }

  const statusCode = reply.statusCode
  // 206 bodies are ranges of the unencoded representation, and 204 and 304 have no body at all
  if (statusCode === 204 || statusCode === 206 || statusCode === 304 || reply.hasHeader('content-range')) {
    return false
  }

  const encoding = reply.getHeader('content-encoding')
  if (encoding && encoding !== 'identity') {
    return false
  }

  if (noTransform.test(reply.getHeader('cache-control') ?? '')) {
    return false
  }

  if (!compressibleTypes.test(reply.getHeader('content-type') ?? '')) {
    return false
  }

  const length = reply.getHeader('content-length')
  if (length !== undefined && Number(length) < compression.threshold) {
    return false
  }

  if (compression.exclude.length > 0) {
    const path = request.url.split('?', 1)[0]
    if (compression.exclude.some(pattern => pattern.test(path))) {
      return false
    }
  }

  return true
}

function addVary (reply) {
  const current = reply.getHeader('vary')

  if (current === undefined) {
    reply.header('vary', 'accept-encoding')
    return
  }

  const value = Array.isArray(current) ? current.join(', ') : String(current)
  const tokens = value.split(',').map(token => token.trim().toLowerCase())

  if (!tokens.includes('accept-encoding') && !tokens.includes('*')) {
    reply.header('vary', `${value}, accept-encoding`)
  }
}

// Sends a proxied response, compressing it when the client accepts one of the configured encodings.
// A response the gateway would compress varies on Accept-Encoding even when this client gets it
// uncompressed, so Vary is set on all of them.
export function sendCompressed (request, reply, stream, compression) {
  if (!isCompressible(request, reply, compression)) {
    return reply.send(stream)
  }

  addVary(reply)
  return reply.compress(stream)
}
