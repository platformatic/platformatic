const { createServer } = require('node:http')

const isMain = require.main === module && require.main.filename === __filename

module.exports = createServer((_, res) => {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })
  res.end(JSON.stringify({ isMain }))
})

module.exports.listen(0)
