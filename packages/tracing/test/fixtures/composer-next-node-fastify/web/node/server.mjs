import { createServer } from 'node:http';

export function build () {
  let count = 0

  const server = createServer((req, res) => {
    console.log('received request', req.url)
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ content: `from node:http createServer: ${count++}!` }));
  })

  return server
}
