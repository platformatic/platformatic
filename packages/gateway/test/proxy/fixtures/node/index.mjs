import { createServer } from 'node:http'

const server = createServer((req, res) => {
  if (req.url === '/hello') {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ ok: true }))
  } else if (req.url === '/id') {
    res.writeHead(200, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ from: 'node' }))
  } else if (req.url === '/redirect') {
    res.writeHead(307, {
      'content-type': 'application/json',
      connection: 'close',
      location: `http://localhost:${server.address().port}/id`
    })
    res.end(JSON.stringify({ from: 'node' }))
  } else if (req.url === '/redirect-secure') {
    res.writeHead(307, {
      'content-type': 'application/json',
      connection: 'close',
      location: `https://localhost:${server.address().port}/id`
    })
    res.end(JSON.stringify({ from: 'node' }))
  } else if (req.url === '/headers') {
    res.writeHead(200, {
      'content-type': 'application/json'
    })
    res.end(JSON.stringify({ headers: req.headers }))
  } else {
    res.writeHead(404, {
      'content-type': 'application/json',
      connection: 'close'
    })
    res.end(JSON.stringify({ ok: false, url: req.url }))
  }
})

// This would likely fail if our code doesn't work
server.listen(1)
