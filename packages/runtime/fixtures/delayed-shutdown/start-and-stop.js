'use strict'
const { startCommand } = require('../..')

async function main () {
  await startCommand(['-c', process.argv[2]])

  setTimeout(() => {
    process.kill(process.pid, 'SIGINT')
  })
}

main()
