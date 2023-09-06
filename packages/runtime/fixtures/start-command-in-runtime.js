'use strict'
const assert = require('node:assert')
const { request } = require('undici')
const { startCommand } = require('..')

async function main () {
  const entrypoint = await startCommand(['-c', process.argv[2]])
  const endpoint = process.argv[3] ?? '/'
  const res = await request(entrypoint + endpoint)

  assert.strictEqual(res.statusCode, 200)
  process.exit(42)
}

main()
