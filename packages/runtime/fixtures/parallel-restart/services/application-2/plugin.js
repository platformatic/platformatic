'use strict'

const { createServer } = require('node:http')

async function build () {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })

  return server
}

module.exports = { build }
