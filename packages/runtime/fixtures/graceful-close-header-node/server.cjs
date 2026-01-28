'use strict'

const { createServer } = require('node:http')

function build () {
  const server = createServer((req, res) => {
    // Simulate slow response to give time for testing
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    }, 100)
  })

  return server
}

module.exports = { build }
