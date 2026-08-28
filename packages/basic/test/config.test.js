import { deepStrictEqual, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { applyPortAssignment, transform } from '../lib/config.js'

test('applyPortAssignment - should not modify the server config when portAssignment is not perWorkerIncrement', () => {
  deepStrictEqual(applyPortAssignment(undefined, { index: 2 }), undefined)

  for (const server of [{ port: 3000 }, { port: 3000, portAssignment: 'shared' }]) {
    const expected = structuredClone(server)
    strictEqual(applyPortAssignment(server, { index: 2, portOffset: 2 }), server)
    deepStrictEqual(server, expected)
  }
})

test('applyPortAssignment - should increment the port using the worker port offset', () => {
  deepStrictEqual(
    applyPortAssignment({ port: 3000, portAssignment: 'perWorkerIncrement' }, { index: 0, portOffset: 0 }),
    { port: 3000, portAssignment: 'perWorkerIncrement' }
  )

  deepStrictEqual(
    applyPortAssignment({ port: 3000, portAssignment: 'perWorkerIncrement' }, { index: 2, portOffset: 2 }),
    { port: 3002, portAssignment: 'perWorkerIncrement' }
  )

  // A worker replacing another one inherits its port offset
  deepStrictEqual(
    applyPortAssignment({ port: 3000, portAssignment: 'perWorkerIncrement' }, { index: 7, portOffset: 1 }),
    { port: 3001, portAssignment: 'perWorkerIncrement' }
  )

  // Fallback to the worker index when the offset is not available
  deepStrictEqual(applyPortAssignment({ port: 3000, portAssignment: 'perWorkerIncrement' }, { index: 3 }), {
    port: 3003,
    portAssignment: 'perWorkerIncrement'
  })

  // Ports can be provided as strings
  deepStrictEqual(applyPortAssignment({ port: '3000', portAssignment: 'perWorkerIncrement' }, { index: 1 }), {
    port: 3001,
    portAssignment: 'perWorkerIncrement'
  })
})

test('applyPortAssignment - should not increment ephemeral or missing ports', () => {
  deepStrictEqual(applyPortAssignment({ port: 0, portAssignment: 'perWorkerIncrement' }, { index: 2 }), {
    port: 0,
    portAssignment: 'perWorkerIncrement'
  })

  deepStrictEqual(applyPortAssignment({ portAssignment: 'perWorkerIncrement' }, { index: 2 }), {
    portAssignment: 'perWorkerIncrement'
  })

  deepStrictEqual(applyPortAssignment({ port: 3000, portAssignment: 'perWorkerIncrement' }, undefined), {
    port: 3000,
    portAssignment: 'perWorkerIncrement'
  })
})

test('transform - should not modify the port outside of a runtime worker', async () => {
  const config = await transform({ server: { port: 3000, portAssignment: 'perWorkerIncrement' } })

  strictEqual(config.server.port, 3000)
})
