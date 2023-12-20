'use strict'

/*
class FakeFinalizationRegistry {
  constructor () {
    process._rawDebug('FakeFinalizationRegistry: constructor', new Error().stack)
  }
  register () {}
  unregister () {}
}

global.FinalizationRegistry = FakeFinalizationRegistry

const oldFetch = global.fetch
function fakefetch (...args) {
  process._rawDebug('fakefetch', args, new Error().stack)
  return oldFetch(...args)
}
*/

const assert = require('node:assert')
const { request, setGlobalDispatcher, Agent } = require('undici')
const { startCommand } = require('..')

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 1,
  keepAliveMaxTimeout: 1
}))

async function main () {
  const entrypoint = await startCommand(['-c', process.argv[2]])
  process._rawDebug('start-command-in-runtime.js: started')
  const endpoint = process.argv[3] ?? '/'
  const res = await request(entrypoint + endpoint)

  assert.strictEqual(res.statusCode, 200)

  // Consume the body so the service can end
  await res.body.text()
  process._rawDebug('start-command-in-runtime.js: exiting')
  process.exit(42)
}

main()
