import { getApplicationId } from '@platformatic/globals'
import { createServer } from 'node:http'

const server = createServer((req, res) => {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })
  res.end(JSON.stringify({ service: getApplicationId() }))
})

server.listen(0)
