import { randomUUID } from 'node:crypto'

const DEFAULT_BUDGET_MS = 30_000

function isObject (value) {
  return value !== null && typeof value === 'object'
}

function identityKey (identity) {
  return `${identity.tenant ?? ''}\u0000${identity.service}\u0000${identity.versionLabel}`
}

function controlPlaneError (message, code) {
  return Object.assign(new Error(message), { code })
}

function validateIdentity (identity) {
  if (!isObject(identity) || typeof identity.service !== 'string' || identity.service.length === 0 ||
      typeof identity.versionLabel !== 'string' || identity.versionLabel.length === 0) {
    throw new TypeError('A remote handler identity requires a service and version label')
  }
  if (identity.tenant !== undefined && (typeof identity.tenant !== 'string' || identity.tenant.length === 0)) {
    throw new TypeError('Remote handler identity tenant must be a non-empty string')
  }
}

function validateManifest (manifest) {
  if (!isObject(manifest) || typeof manifest.manifestHash !== 'string' || !Array.isArray(manifest.endpoints)) {
    throw new TypeError('A remote handler manifest must contain a hash and endpoint list')
  }
  const endpoints = new Set()
  for (const endpoint of manifest.endpoints) {
    if (!isObject(endpoint) || typeof endpoint.name !== 'string' || endpoint.name.length === 0 || endpoints.has(endpoint.name)) {
      throw new TypeError('A remote handler manifest contains an invalid endpoint')
    }
    endpoints.add(endpoint.name)
  }
}

function validateBudget (budget) {
  if (!Number.isSafeInteger(budget) || budget < 1) {
    throw new RangeError('Remote handler budget must be a positive integer')
  }
}

/**
 * Create an in-process control plane for a Watt-only or self-managed runtime.
 *
 * This adapter deliberately has no socket, authentication, or ICC dependency.
 * A host can share one instance between caller and handler capabilities, or
 * replace the maps with a durable implementation behind the same interface.
 */
export function createLocalRemoteHandlerControlPlane (options = {}) {
  if (!isObject(options)) throw new TypeError('Local remote handler control plane options must be an object')
  const handlers = new Map()
  const operations = new Map()
  const maxQueueSize = options.maxQueueSize ?? Infinity
  if (maxQueueSize !== Infinity && (!Number.isSafeInteger(maxQueueSize) || maxQueueSize < 1)) {
    throw new RangeError('Local remote handler queue size must be a positive integer')
  }

  function getHandler (identity) {
    return handlers.get(identityKey(identity))
  }

  async function registerManifest ({ identity, manifest }) {
    validateIdentity(identity)
    validateManifest(manifest)
    const key = identityKey(identity)
    const current = handlers.get(key)
    if (current && current.manifest.manifestHash !== manifest.manifestHash) {
      throw controlPlaneError('Remote handler manifest conflicts with the registered local manifest', 'manifest_conflict')
    }
    if (current) {
      current.manifest = manifest
      return { changed: false }
    }
    handlers.set(key, {
      identity: { ...identity },
      manifest,
      announced: false,
      queue: [],
      claimed: new Map()
    })
    return { changed: true }
  }

  function createHandlerTransport ({ identity, manifest }) {
    validateIdentity(identity)
    if (!isObject(manifest) || typeof manifest.manifestHash !== 'string') {
      throw new TypeError('A local remote handler transport requires a private manifest')
    }
    const handler = getHandler(identity)
    if (!handler) throw controlPlaneError('Remote handler manifest has not been registered', 'manifest_unavailable')
    if (handler.manifest.manifestHash !== manifest.manifestHash) {
      throw controlPlaneError('Remote handler manifest conflicts with the registered local manifest', 'manifest_conflict')
    }
    let closed = false
    return {
      async announceHandler () {
        if (!closed) handler.announced = true
      },
      async claim (capacity) {
        if (closed) return []
        const claimed = handler.queue.splice(0, capacity)
        for (const operation of claimed) handler.claimed.set(operation.token, operation)
        return claimed.map(({ resolve, reject, timer, ...operation }) => operation)
      },
      async heartbeat (tokens) {
        if (closed) return
        for (const token of tokens) {
          if (!handler.claimed.has(token)) throw controlPlaneError('Remote handler claim is stale', 'remote_handler_claim_stale')
        }
      },
      async reportStarted ({ token, handlerRunId }) {
        const operation = handler.claimed.get(token)
        if (!operation) throw controlPlaneError('Remote handler claim is stale', 'remote_handler_claim_stale')
        operation.handlerRunId = handlerRunId
      },
      async reportResult ({ token, outcome }) {
        const operation = handler.claimed.get(token)
        if (!operation) throw controlPlaneError('Remote handler claim is stale', 'remote_handler_claim_stale')
        handler.claimed.delete(token)
        operations.delete(operation.operationKey)
        clearTimeout(operation.timer)
        operation.resolve(outcome)
      },
      async reconcileHandlerRuns (runs) {
        return runs.map(run => ({
          operationKey: run.operationKey,
          action: operations.has(run.operationKey) ? 'keep' : 'unknown'
        }))
      },
      async close () {
        closed = true
        handler.announced = false
        for (const operation of handler.claimed.values()) {
          handler.claimed.delete(operation.token)
          operations.delete(operation.operationKey)
          clearTimeout(operation.timer)
          operation.reject(controlPlaneError('Local remote handler transport closed', 'remote_handler_unavailable'))
        }
      }
    }
  }

  async function dispatch ({ identity, endpoint, payload, budget = DEFAULT_BUDGET_MS }) {
    validateIdentity(identity)
    if (typeof endpoint !== 'string' || endpoint.length === 0) throw new TypeError('Remote endpoint is required')
    validateBudget(budget)
    const handler = getHandler(identity)
    if (!handler) throw controlPlaneError('Remote handler is not registered', 'remote_handler_unavailable')
    if (!handler.manifest.endpoints.some(candidate => candidate.name === endpoint)) {
      throw controlPlaneError(`Remote endpoint ${JSON.stringify(endpoint)} is not registered`, 'endpoint_unknown')
    }
    if (handler.queue.length >= maxQueueSize) {
      throw controlPlaneError('Local remote handler queue is full', 'admission_rejected')
    }
    const operationKey = randomUUID()
    const token = randomUUID()
    const operation = {
      operationKey,
      endpoint,
      payload,
      token,
      budget: { remaining: budget },
    }
    const result = new Promise((resolve, reject) => {
      operation.resolve = resolve
      operation.reject = reject
      operation.timer = setTimeout(() => {
        if (!operations.delete(operationKey)) return
        handler.queue = handler.queue.filter(candidate => candidate.operationKey !== operationKey)
        handler.claimed.delete(token)
        reject(controlPlaneError('Remote handler operation timed out', 'budget_exhausted'))
      }, budget)
      operation.timer.unref?.()
    })
    operations.set(operationKey, operation)
    handler.queue.push(operation)
    return result
  }

  return {
    registerManifest,
    createHandlerTransport,
    dispatch,
    getHandler (identity) {
      const handler = getHandler(identity)
      return handler && {
        identity: { ...handler.identity },
        manifest: handler.manifest,
        announced: handler.announced,
        queued: handler.queue.length,
        claimed: handler.claimed.size
      }
    },
    async close () {
      for (const handler of handlers.values()) {
        for (const operation of [...handler.queue, ...handler.claimed.values()]) {
          clearTimeout(operation.timer)
          operation.reject?.(controlPlaneError('Local remote handler control plane closed', 'remote_handler_unavailable'))
        }
      }
      handlers.clear()
      operations.clear()
    }
  }
}
