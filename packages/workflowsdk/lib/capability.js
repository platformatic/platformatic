import { createRequire } from 'node:module'
import { access } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_REMOTE_HANDLER_MANIFEST_PATH = '.well-known/workflow/v1/remote-handlers.json'
export const DEFAULT_REMOTE_MANIFEST_PATH = '.well-known/workflow/v1/remote-manifest.json'

const kStartedStates = new Set(['starting', 'started'])

function isFunction (value) {
  return typeof value === 'function'
}

function isObject (value) {
  return value !== null && typeof value === 'object'
}

function manifestPathFor (root, manifestPath) {
  return isAbsolute(manifestPath) ? manifestPath : resolve(root, manifestPath)
}

function publicManifestPathFor (privateManifestPath) {
  return join(dirname(privateManifestPath), basename(DEFAULT_REMOTE_MANIFEST_PATH))
}

function identityFor (options) {
  return {
    tenant: options.identity?.tenant,
    service: options.identity?.service,
    versionLabel: options.identity?.versionLabel
  }
}

async function fileExists (path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function validateOptions (options) {
  if (!isObject(options) || typeof options.root !== 'string' || options.root.length === 0) {
    throw new TypeError('Workflow SDK capability requires an application root')
  }
  if (options.identity !== undefined && !isObject(options.identity)) {
    throw new TypeError('Workflow SDK capability identity must be an object')
  }
  const identity = identityFor(options)
  if (identity.tenant !== undefined && (typeof identity.tenant !== 'string' || identity.tenant.length === 0)) {
    throw new TypeError('Workflow SDK capability identity tenant must be a non-empty string')
  }
  if (identity.service !== undefined && (typeof identity.service !== 'string' || identity.service.length === 0)) {
    throw new TypeError('Workflow SDK capability identity service must be a non-empty string')
  }
  if (identity.versionLabel !== undefined && (typeof identity.versionLabel !== 'string' || identity.versionLabel.length === 0)) {
    throw new TypeError('Workflow SDK capability identity version label must be a non-empty string')
  }
  if (options.manifestPath !== undefined && (typeof options.manifestPath !== 'string' || options.manifestPath.length === 0)) {
    throw new TypeError('Workflow SDK capability manifestPath must be a non-empty string')
  }
  if (options.controlPlane !== undefined && (!isObject(options.controlPlane) ||
      !isFunction(options.controlPlane.registerManifest) || !isFunction(options.controlPlane.createHandlerTransport))) {
    throw new TypeError('Workflow SDK capability control plane must expose registerManifest and createHandlerTransport')
  }
}

/**
 * Resolve the remote runtime from the application dependency graph. The
 * Platformatic package deliberately does not depend on @platformatic/remote-workflow:
 * the latter is published by Platformatic World and is optional for apps that
 * do not build remote handlers.
 */
export async function loadRemoteRuntime (root) {
  const require = createRequire(resolve(root, 'package.json'))
  const modulePath = require.resolve('@platformatic/remote-workflow/runtime')
  return import(pathToFileURL(modulePath).href)
}

/**
 * Resolve the public manifest reader from the application's optional remote
 * package. Keeping this separate from the runtime import lets applications
 * without remote artifacts retain the inexpensive no-op path.
 */
export async function loadRemoteManifest (root) {
  const require = createRequire(resolve(root, 'package.json'))
  const modulePath = require.resolve('@platformatic/remote-workflow/manifest')
  return import(pathToFileURL(modulePath).href)
}

function protocolError (message, code = 'remote_manifest_registration_failed') {
  const error = new Error(message)
  error.code = code
  return error
}

export class WorkflowSDKCapability {
  #options
  #worker
  #startPromise
  #status

  constructor (options) {
    validateOptions(options)
    this.#options = {
      ...options,
      manifestPath: options.manifestPath ?? DEFAULT_REMOTE_HANDLER_MANIFEST_PATH
    }
    this.#worker = null
    this.#startPromise = null
    this.#status = { state: 'idle' }
  }

  get status () {
    return { ...this.#status }
  }

  async start () {
    if (this.#worker || this.#status.state === 'started') {
      return this.status
    }
    if (this.#startPromise) {
      return this.#startPromise
    }

    this.#startPromise = this.#start()
    try {
      return await this.#startPromise
    } catch (error) {
      this.#setStatus({
        state: 'failed',
        manifestPath: this.#status.manifestPath
      })
      this.#options.logger?.error?.({ err: error }, 'Workflow SDK remote handler capability failed to start')
      throw error
    } finally {
      this.#startPromise = null
    }
  }

  async #start () {
    const options = this.#options
    const manifestPath = manifestPathFor(options.root, options.manifestPath)
    const publicManifestPath = publicManifestPathFor(manifestPath)

    // Checking the inexpensive local prerequisites first keeps applications
    // without a configured control plane or remote handlers on the zero-work
    // startup path.
    if (!options.controlPlane) {
      this.#setStatus({ state: 'disabled', reason: 'control-plane-unavailable', manifestPath })
      return this.status
    }
    const identity = identityFor(options)
    if (!identity.service || !identity.versionLabel) {
      this.#setStatus({ state: 'disabled', reason: 'identity-unavailable', manifestPath })
      return this.status
    }
    if (!await fileExists(manifestPath)) {
      this.#setStatus({ state: 'disabled', reason: 'manifest-unavailable', manifestPath })
      return this.status
    }
    if (!await fileExists(publicManifestPath)) {
      this.#setStatus({ state: 'disabled', reason: 'manifest-unavailable', manifestPath })
      return this.status
    }

    this.#setStatus({ state: 'starting', manifestPath })
    const remote = options.remoteRuntime ?? await loadRemoteRuntime(options.root)

    if (!isFunction(remote.readRemoteHandlerManifest) ||
        !isFunction(remote.createRemoteHandlerTransport) ||
        !isFunction(remote.registerRemoteHandlerRuntime)) {
      throw new TypeError('@platformatic/remote-workflow/runtime does not expose the handler runtime API')
    }

    const manifest = await remote.readRemoteHandlerManifest(manifestPath)
    const manifestReader = remote.readRemoteManifest ?? (await loadRemoteManifest(options.root)).readRemoteManifest
    if (!isFunction(manifestReader)) {
      throw new TypeError('@platformatic/remote-workflow/manifest does not expose readRemoteManifest')
    }
    const publicManifest = await manifestReader(publicManifestPath)
    if (publicManifest.manifestHash !== manifest.manifestHash) {
      throw protocolError('Remote public and private manifest hashes do not match', 'manifest_conflict')
    }
    const runtimeIdentity = {
      ...identity,
      manifestHash: manifest.manifestHash
    }
    await options.controlPlane.registerManifest({
      identity: runtimeIdentity,
      manifest: publicManifest
    })
    const transport = await options.controlPlane.createHandlerTransport({
      identity: runtimeIdentity,
      manifest,
      publicManifest,
      remoteRuntime: remote,
      reconciliation: options.reconciliation
    })
    if (!transport || !isObject(transport)) {
      throw protocolError('Workflow SDK control plane did not create a handler transport', 'transport-unavailable')
    }

    this.#worker = await remote.registerRemoteHandlerRuntime({
      identity: runtimeIdentity,
      manifest,
      transport,
      applicationRoot: options.root,
      capacity: options.capacity,
      heartbeatIntervalMs: options.heartbeatIntervalMs,
      log: options.logger ?? console
    })
    this.#setStatus({ state: 'started', manifestPath })
    options.logger?.info?.({ service: identity.service, versionLabel: identity.versionLabel }, 'Workflow SDK remote handler capability started')
    return this.status
  }

  async setControlPlane (controlPlane) {
    if (controlPlane !== undefined && (!isObject(controlPlane) ||
        !isFunction(controlPlane.registerManifest) || !isFunction(controlPlane.createHandlerTransport))) {
      throw new TypeError('Workflow SDK capability control plane must expose registerManifest and createHandlerTransport')
    }

    const wasStarted = kStartedStates.has(this.#status.state)
    await this.stop()
    this.#options.controlPlane = controlPlane
    if (wasStarted || controlPlane) {
      return this.start()
    }
    return this.status
  }

  async stop () {
    if (this.#startPromise) {
      await this.#startPromise.catch(() => {})
    }
    const worker = this.#worker
    this.#worker = null
    if (worker?.close) {
      await worker.close()
    }
    if (this.#status.state !== 'idle') {
      this.#setStatus({ state: 'stopped', manifestPath: this.#status.manifestPath })
    }
  }

  close () {
    return this.stop()
  }

  #setStatus (status) {
    this.#status = status
  }
}

export function createWorkflowSDKCapability (options) {
  return new WorkflowSDKCapability(options)
}
