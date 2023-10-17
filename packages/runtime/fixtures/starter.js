'use strict'
const { start } = require('..')

async function main () {
  await start(['-c', process.argv[2]])
  process.exit(42)
}

main()
