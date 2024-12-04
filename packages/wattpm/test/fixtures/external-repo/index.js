const { createServer } = require('node:http')

function create () {
  return createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify({ ok: true }))
  })
}

module.exports = { create }
