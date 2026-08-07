import { createServer } from 'node:http'

let server

export function create () {
  server = createServer((_, res) => {
    res.end('ok')
  })

  return server
}

export async function close () {
  // Close the bound server first so the worker can exit, then throw so the
  // runtime stop path must log the error instead of swallowing it.
  await new Promise((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()))
  })

  const error = new Error('boom while closing')
  error.code = 'TEST_CLOSE_FAILED'
  throw error
}
