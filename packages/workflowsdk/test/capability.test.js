import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { WorkflowSDKCapability, createLocalRemoteHandlerControlPlane, createWorkflowSDKCapability } from '../index.js'

async function fixture (manifest = null, publicManifest = null) {
  const root = await mkdtemp(join(tmpdir(), 'platformatic-workflowsdk-'))
  const manifestPath = join(root, '.well-known/workflow/v1/remote-handlers.json')
  const publicManifestPath = join(root, '.well-known/workflow/v1/remote-manifest.json')
  if (manifest || publicManifest) {
    const { dirname } = await import('node:path')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(dirname(manifestPath), { recursive: true })
    if (manifest) await writeFile(manifestPath, JSON.stringify(manifest))
    if (publicManifest) await writeFile(publicManifestPath, JSON.stringify(publicManifest))
  }
  return { root, manifestPath, publicManifestPath }
}

function remoteRuntime (events, manifest, publicManifest) {
  return {
    async readRemoteHandlerManifest (path) {
      events.push(['read', path])
      return manifest
    },
    async readRemoteManifest (path) {
      events.push(['read-public', path])
      return publicManifest
    },
    createRemoteHandlerTransport (options) {
      events.push(['transport', options.tenant, options.identity])
      return { options }
    },
    async registerRemoteHandlerRuntime (options) {
      events.push(['start', options.identity, options.capacity, options.heartbeatIntervalMs])
      return {
        async close () {
          events.push(['close'])
        }
      }
    }
  }
}

function controlPlane (events) {
  return {
    async registerManifest ({ identity, manifest }) {
      events.push(['register', identity, manifest])
    },
    createHandlerTransport ({ identity }) {
      events.push(['transport', identity])
      return {}
    }
  }
}

test('capability is inert without a control plane', async t => {
  const { root } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))

  const capability = createWorkflowSDKCapability({
    root,
    identity: { service: 'service', versionLabel: 'version' }
  })

  assert.deepEqual(await capability.start(), {
    state: 'disabled',
    reason: 'control-plane-unavailable',
    manifestPath: join(root, '.well-known/workflow/v1/remote-handlers.json')
  })
})

test('capability starts with the local control plane without an ICC tenant', async t => {
  const manifest = { v: 1, manifestHash: '9'.repeat(64), handlers: {} }
  const publicManifest = { v: 1, manifestHash: manifest.manifestHash, endpoints: [] }
  const { root } = await fixture(manifest, publicManifest)
  t.after(() => rm(root, { recursive: true, force: true }))
  const controlPlane = createLocalRemoteHandlerControlPlane()
  t.after(() => controlPlane.close())
  const remoteRuntime = {
    async readRemoteHandlerManifest () { return manifest },
    async readRemoteManifest () { return publicManifest },
    createRemoteHandlerTransport () {},
    async registerRemoteHandlerRuntime ({ transport }) {
      await transport.announceHandler()
      return { async close () { await transport.close?.() } }
    }
  }
  const capability = createWorkflowSDKCapability({
    root,
    identity: { service: 'inventory', versionLabel: 'local' },
    controlPlane,
    remoteRuntime
  })

  assert.equal((await capability.start()).state, 'started')
  assert.equal(controlPlane.getHandler({ service: 'inventory', versionLabel: 'local' }).announced, true)
  await capability.stop()
})
test('capability is inert when no private manifest was emitted', async t => {
  const { root } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))

  const capability = new WorkflowSDKCapability({
    root,
    identity: { service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane([]),
    remoteRuntime: remoteRuntime([], {})
  })

  const status = await capability.start()
  assert.equal(status.state, 'disabled')
  assert.equal(status.reason, 'manifest-unavailable')
})

test('capability is inert when the public manifest was not emitted', async t => {
  const manifest = { v: 1, manifestHash: '0'.repeat(64), handlers: {} }
  const { root } = await fixture(manifest)
  t.after(() => rm(root, { recursive: true, force: true }))

  const capability = new WorkflowSDKCapability({
    root,
    identity: { service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane([]),
    remoteRuntime: remoteRuntime([], manifest)
  })

  const status = await capability.start()
  assert.equal(status.state, 'disabled')
  assert.equal(status.reason, 'manifest-unavailable')
})

test('capability reports malformed manifests instead of publishing a partial identity', async t => {
  const { root } = await fixture({ v: 1 }, {
    v: 1,
    manifestHash: 'd'.repeat(64),
    endpoints: []
  })
  t.after(() => rm(root, { recursive: true, force: true }))

  const capability = new WorkflowSDKCapability({
    root,
    identity: { service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane([]),
    remoteRuntime: {
      async readRemoteHandlerManifest () {
        throw new TypeError('Remote handler manifest is invalid')
      },
      createRemoteHandlerTransport () {},
      registerRemoteHandlerRuntime () {}
    }
  })

  await assert.rejects(capability.start(), /Remote handler manifest is invalid/)
  assert.equal(capability.status.state, 'failed')
})

test('capability starts and closes the protocol worker through a control plane', async t => {
  const manifest = {
    v: 1,
    manifestHash: 'a'.repeat(64),
    handlers: { 'inventory.reserve': { workflowId: 'workflow-id' } }
  }
  const publicManifest = {
    v: 1,
    manifestHash: manifest.manifestHash,
    endpoints: [{
      name: 'inventory.reserve',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' }
    }]
  }
  const { root, manifestPath, publicManifestPath } = await fixture(manifest, publicManifest)
  t.after(() => rm(root, { recursive: true, force: true }))
  const events = []
  const capability = new WorkflowSDKCapability({
    root,
    identity: { tenant: 'tenant', service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane(events),
    capacity: 4,
    heartbeatIntervalMs: 2500,
    remoteRuntime: remoteRuntime(events, manifest, publicManifest)
  })

  assert.deepEqual(await capability.start(), { state: 'started', manifestPath })
  assert.deepEqual(events, [
    ['read', manifestPath],
    ['read-public', publicManifestPath],
    ['register', { tenant: 'tenant', service: 'service', versionLabel: 'version', manifestHash: 'a'.repeat(64) }, publicManifest],
    ['transport', { tenant: 'tenant', service: 'service', versionLabel: 'version', manifestHash: 'a'.repeat(64) }],
    ['start', { tenant: 'tenant', service: 'service', versionLabel: 'version', manifestHash: 'a'.repeat(64) }, 4, 2500]
  ])
  await capability.stop()
  assert.deepEqual(events.at(-1), ['close'])
  assert.equal(capability.status.state, 'stopped')
})

test('start is idempotent and concurrent starts share one worker', async t => {
  const manifest = { v: 1, manifestHash: 'b'.repeat(64), handlers: {} }
  const publicManifest = { v: 1, manifestHash: manifest.manifestHash, endpoints: [] }
  const { root } = await fixture(manifest, publicManifest)
  t.after(() => rm(root, { recursive: true, force: true }))
  const events = []
  const capability = new WorkflowSDKCapability({
    root,
    identity: { tenant: 'tenant', service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane(events),
    remoteRuntime: remoteRuntime(events, manifest, publicManifest)
  })

  const statuses = await Promise.all([capability.start(), capability.start(), capability.start()])
  assert.equal(statuses.filter(status => status.state === 'started').length, 3)
  assert.equal(events.filter(event => event[0] === 'start').length, 1)
  await capability.start()
  assert.equal(events.filter(event => event[0] === 'start').length, 1)
})

test('setControlPlane closes the old worker before restarting', async t => {
  const manifest = { v: 1, manifestHash: 'c'.repeat(64), handlers: {} }
  const publicManifest = { v: 1, manifestHash: manifest.manifestHash, endpoints: [] }
  const { root } = await fixture(manifest, publicManifest)
  t.after(() => rm(root, { recursive: true, force: true }))
  const events = []
  const capability = new WorkflowSDKCapability({
    root,
    identity: { tenant: 'tenant', service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane(events),
    remoteRuntime: remoteRuntime(events, manifest, publicManifest)
  })

  await capability.start()
  await capability.setControlPlane(controlPlane(events))
  assert.deepEqual(events.map(event => event[0]), ['read', 'read-public', 'register', 'transport', 'start', 'close', 'read', 'read-public', 'register', 'transport', 'start'])
  assert.equal(capability.status.state, 'started')
})

test('capability refuses to start when public and private manifests disagree', async t => {
  const privateManifest = { v: 1, manifestHash: 'e'.repeat(64), handlers: {} }
  const publicManifest = { v: 1, manifestHash: 'f'.repeat(64), endpoints: [] }
  const { root } = await fixture(privateManifest, publicManifest)
  t.after(() => rm(root, { recursive: true, force: true }))

  const capability = new WorkflowSDKCapability({
    root,
    identity: { tenant: 'tenant', service: 'service', versionLabel: 'version' },
    controlPlane: controlPlane([]),
    remoteRuntime: remoteRuntime([], privateManifest, publicManifest)
  })

  await assert.rejects(capability.start(), error => {
    assert.equal(error.code, 'manifest_conflict')
    assert.match(error.message, /hashes do not match/)
    return true
  })
  assert.equal(capability.status.state, 'failed')
})

test('capability surfaces ICC registration failures before starting handlers', async t => {
  const manifest = { v: 1, manifestHash: '1'.repeat(64), handlers: {} }
  const publicManifest = { v: 1, manifestHash: manifest.manifestHash, endpoints: [] }
  const { root } = await fixture(manifest, publicManifest)
  t.after(() => rm(root, { recursive: true, force: true }))
  const events = []
  const capability = new WorkflowSDKCapability({
    root,
    identity: { tenant: 'tenant', service: 'service', versionLabel: 'version' },
    controlPlane: {
      async registerManifest () {
        throw Object.assign(new Error('already registered with another schema'), { code: 'manifest_conflict' })
      },
      createHandlerTransport () {
        events.push(['transport'])
        return {}
      }
    },
    remoteRuntime: remoteRuntime(events, manifest, publicManifest)
  })

  await assert.rejects(capability.start(), /already registered with another schema/)
  assert.deepEqual(events.map(event => event[0]), ['read', 'read-public'])
  assert.equal(capability.status.state, 'failed')
})
