import { createServer } from 'node:http'

export function create () {
  const server = createServer((_, res) => {
    res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
  })

  return {
    listen (...args) {
      return server.listen(...args)
    },
    async [Symbol.asyncDispose] () {
      globalThis.platformatic?.events.emitAndNotify('custom:asyncDispose')
      await new Promise((resolve, reject) => {
        server.close(err => err ? reject(err) : resolve())
      })
    }
  }
}
