'use strict'
const assert = require('node:assert')
const { request } = require('undici')
const { startCommandInRuntime } = require('../lib/unified-api')

async function main () {
  const entrypoint = await startCommandInRuntime(['-c', process.argv[2]])
  const res = await request(entrypoint)

  assert.strictEqual(res.statusCode, 200)
  process.exit(42)
}

main()
