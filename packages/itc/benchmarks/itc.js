// Measures the per-message cost of ITC: payload sanitization and request/response round trips.
// Both ends of the MessageChannel live in this thread, so the CPU column covers sender and receiver.
//
// Usage: node benchmarks/itc.js [name filter]
import { MessageChannel } from 'node:worker_threads'
import { generateRequest, ITC, sanitize } from '../lib/index.js'
import { createRows, measure, measureAsync } from './utils.js'

const filter = process.argv[2]
const rows = createRows(100)

const query = {
  sql: 'SELECT id, name FROM storage.objects WHERE bucket_id = $1 AND name = $2 LIMIT 1',
  values: ['avatars', 'folder/file.png'],
  destination: { id: 'tenant', isExternalPool: false, maxConnections: 10 }
}

function shouldRun (name) {
  return !filter || name.includes(filter)
}

if (shouldRun('sanitize')) {
  const request = generateRequest('database.query', query)
  const response = { type: 'PLT_ITC_RESPONSE', version: '1.0.0', reqId: 'id', name: 'q', error: null, data: { rows } }

  measure('sanitize: small request', 500_000, () => sanitize(request, []))
  measure('sanitize: response with 100 rows', 20_000, () => sanitize(response, []))
}

if (shouldRun('send')) {
  const { port1, port2 } = new MessageChannel()
  const sender = new ITC({ port: port1, name: 'sender' })
  const receiver = new ITC({ port: port2, name: 'receiver' })

  receiver.handle('query', () => ({ rows: [{ id: 1 }], rowCount: 1 }))
  receiver.handle('rows', () => ({ rows, rowCount: rows.length }))
  receiver.handle('rows-unsanitized', () => ({ rows, rowCount: rows.length }), { sanitize: false })
  sender.listen()
  receiver.listen()

  const signal = new AbortController().signal

  await measureAsync('send: small payload', 50_000, 1, () => sender.send('query', query))
  await measureAsync('send: small payload, 32 in flight', 100_000, 32, () => sender.send('query', query))
  await measureAsync('send: small payload, with signal', 50_000, 1, () => sender.send('query', query, { signal }))
  await measureAsync('send: small payload, with timeout', 50_000, 1, () => sender.send('query', query, { timeout: 10_000 }))
  await measureAsync('send: response with 100 rows', 5_000, 1, () => sender.send('rows', query))
  await measureAsync('send: response with 100 rows, sanitize: false', 5_000, 1, () =>
    sender.send('rows-unsanitized', query, { sanitize: false })
  )

  sender.close()
  receiver.close()
}
