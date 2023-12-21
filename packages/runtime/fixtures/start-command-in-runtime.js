'use strict'

const assert = require('node:assert')
const { request, setGlobalDispatcher, Agent } = require('undici')
const { startCommand } = require('..')

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 1,
  keepAliveMaxTimeout: 1
}))

async function main () {
  const entrypoint = await startCommand(['-c', process.argv[2]])
  const endpoint = process.argv[3] ?? '/'
  const res = await request(entrypoint + endpoint)

  assert.strictEqual(res.statusCode, 200)

  // Consume the body so the service can end
  await res.body.text()
  process.exit(42)
}

main()
