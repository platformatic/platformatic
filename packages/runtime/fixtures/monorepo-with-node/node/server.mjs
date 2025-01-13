import { createServer } from 'node:http'

let count = 0

console.debug('This is console.debug')
console.info('This is console.info')
console.log('This is console.log')
console.warn('This is console.warn')
console.error('This is console.error')

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ content: `from node:http createServer: ${count++}!` }))
})

server.listen(1)
