'use strict'
const { startCommand } = require('..')

async function main () {
  await startCommand(['-c', process.argv[2]])
  process.exit(42)
}

main()
