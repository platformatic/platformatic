import { EarlyFlushInvalidOptionError as InvalidOptionError } from '../errors.js'

export { InvalidOptionError }

export function defaultPreludeKeyResolver (request) {
  return `${request.method.toUpperCase()} ${request.route}`
}

export const defaultOptions = Object.freeze({
  methods: Object.freeze(['GET', 'HEAD', 'OPTIONS', 'QUERY']),
  prefixPolicy: 'conservative',
  redirectPolicy: 'conservative',
  windowSize: 30,
  minPreludeBytes: 512,
  maxPrefixBytes: 64 * 1024,
  headers: Object.freeze({
    allowlist: Object.freeze([
      'content-type',
      'content-language',
      'link',
      'content-security-policy',
      'referrer-policy',
      'x-content-type-options'
    ]),
    excludeSetCookie: true,
    excludeCspNonce: true,
    keyHeaders: Object.freeze([]),
    cacheControl: 'no-store'
  }),
  memory: Object.freeze({ maxKeys: 1000 })
})

// Routing, custom key resolution and compression belong to the gateway adapter.
export function resolveOptions (options = {}) {
  const resolved = {
    storage: options.storage,
    onSamplingError: options.onSamplingError,
    onEarlyFlushEvent: options.onEarlyFlushEvent,
    methods: Object.freeze([...(options.methods ?? defaultOptions.methods)]),
    prefixPolicy: options.prefixPolicy ?? defaultOptions.prefixPolicy,
    redirectPolicy: options.redirectPolicy ?? defaultOptions.redirectPolicy,
    windowSize: options.windowSize ?? defaultOptions.windowSize,
    minPreludeBytes: options.minPreludeBytes ?? defaultOptions.minPreludeBytes,
    maxPrefixBytes: options.maxPrefixBytes ?? defaultOptions.maxPrefixBytes,
    headers: Object.freeze({
      allowlist: Object.freeze(
        (options.headers?.allowlist ?? defaultOptions.headers.allowlist).map(h => h.toLowerCase())
      ),
      excludeSetCookie: options.headers?.excludeSetCookie ?? defaultOptions.headers.excludeSetCookie,
      excludeCspNonce: options.headers?.excludeCspNonce ?? defaultOptions.headers.excludeCspNonce,
      keyHeaders: Object.freeze(
        (options.headers?.keyHeaders ?? defaultOptions.headers.keyHeaders).map(h => h.toLowerCase())
      ),
      cacheControl: options.headers?.cacheControl ?? defaultOptions.headers.cacheControl
    }),
    memory: Object.freeze({
      maxKeys: options.memory?.maxKeys ?? defaultOptions.memory.maxKeys
    }),
    isResponseEligible: options.isResponseEligible
  }

  // Reject configurations that cannot form a bounded, useful learning window.
  for (const [name, value] of Object.entries({
    windowSize: resolved.windowSize,
    minPreludeBytes: resolved.minPreludeBytes,
    maxPrefixBytes: resolved.maxPrefixBytes,
    'memory.maxKeys': resolved.memory.maxKeys
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new InvalidOptionError(`${name} must be a positive safe integer`)
    }
  }
  if (resolved.minPreludeBytes > resolved.maxPrefixBytes) {
    throw new InvalidOptionError('minPreludeBytes must not exceed maxPrefixBytes')
  }

  for (const policy of [resolved.prefixPolicy, resolved.redirectPolicy]) {
    if (policy !== 'conservative' && policy !== 'fifo') {
      throw new InvalidOptionError('policies must be conservative or fifo')
    }
  }
  if (resolved.methods.some(method => !defaultOptions.methods.includes(method))) {
    throw new InvalidOptionError('methods must be GET, HEAD, OPTIONS or QUERY')
  }

  if (
    (resolved.onSamplingError !== undefined && typeof resolved.onSamplingError !== 'function') ||
    (resolved.onEarlyFlushEvent !== undefined && typeof resolved.onEarlyFlushEvent !== 'function') ||
    (resolved.isResponseEligible !== undefined && typeof resolved.isResponseEligible !== 'function')
  ) {
    throw new InvalidOptionError('callbacks must be functions')
  }

  if (resolved.storage !== undefined) {
    for (const method of ['acquire', 'get', 'access', 'invalidate', 'invalidateMany', 'invalidateAll']) {
      if (resolved.storage === null || typeof resolved.storage[method] !== 'function') {
        throw new InvalidOptionError(`storage.${method} must be a function`)
      }
    }
  }

  return Object.freeze(resolved)
}
