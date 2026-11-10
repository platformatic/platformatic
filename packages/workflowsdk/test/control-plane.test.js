import assert from 'node:assert/strict'
import test from 'node:test'
import { createLocalRemoteHandlerControlPlane } from '../index.js'

const identity = { service: 'inventory', versionLabel: 'local' }
const manifest = {
  v: 1,
  manifestHash: 'a'.repeat(64),
  endpoints: [{ name: 'inventory.reserve', inputSchema: {}, outputSchema: {} }]
}
const privateManifest = {
  v: 1,
  manifestHash: manifest.manifestHash,
  handlers: { 'inventory.reserve': { workflowId: 'reserve' } }
}

test('local control plane registers, claims, and completes an operation', async t => {
  const controlPlane = createLocalRemoteHandlerControlPlane()
  t.after(() => controlPlane.close())

  await controlPlane.registerManifest({ identity, manifest })
  const transport = controlPlane.createHandlerTransport({ identity, manifest: privateManifest })
  await transport.announceHandler()

  const result = controlPlane.dispatch({ identity, endpoint: 'inventory.reserve', payload: { sku: 'ABC' } })
  const [operation] = await transport.claim(1)
  assert.equal(operation.endpoint, 'inventory.reserve')
  assert.deepEqual(operation.payload, { sku: 'ABC' })

  await transport.reportStarted({ token: operation.token, handlerRunId: 'run-1' })
  await transport.reportResult({ token: operation.token, outcome: { ok: true, value: { reservationId: 'r-1' } } })
  assert.deepEqual(await result, { ok: true, value: { reservationId: 'r-1' } })
})

test('local control plane rejects unknown endpoints and manifest conflicts', async t => {
  const controlPlane = createLocalRemoteHandlerControlPlane()
  t.after(() => controlPlane.close())

  await controlPlane.registerManifest({ identity, manifest })
  await assert.rejects(
    controlPlane.dispatch({ identity, endpoint: 'inventory.release', payload: {} }),
    error => error.code === 'endpoint_unknown'
  )
  await assert.rejects(
    controlPlane.registerManifest({
      identity,
      manifest: { ...manifest, manifestHash: 'b'.repeat(64) }
    }),
    error => error.code === 'manifest_conflict'
  )
})

test('local control plane supports a bounded queue', async t => {
  const controlPlane = createLocalRemoteHandlerControlPlane({ maxQueueSize: 1 })
  t.after(() => controlPlane.close())

  await controlPlane.registerManifest({ identity, manifest })
  const first = controlPlane.dispatch({ identity, endpoint: 'inventory.reserve', payload: { sku: 'A' } })
  await assert.rejects(
    controlPlane.dispatch({ identity, endpoint: 'inventory.reserve', payload: { sku: 'B' } }),
    error => error.code === 'admission_rejected'
  )
  const transport = controlPlane.createHandlerTransport({ identity, manifest: privateManifest })
  await transport.announceHandler()
  const [operation] = await transport.claim(1)
  await transport.reportResult({ token: operation.token, outcome: { ok: true, value: null } })
  await first
})
