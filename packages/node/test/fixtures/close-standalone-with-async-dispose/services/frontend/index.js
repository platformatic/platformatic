import { createServer } from 'node:http'

export function create () {
  const app = createServer((_, res) => {
    res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
  })

  app[Symbol.asyncDispose] = async () => {
    globalThis.platformatic?.events.emitAndNotify('asyncDispose')
    await new Promise((resolve, reject) => {
      app.close(err => err ? reject(err) : resolve())
    })
  }

  return app
}
