import { createServer } from 'node:http'

let server

export function create () {
  server = createServer(async (_, res) => {
    try {
      const background = await fetch('http://background.plt.local')
      res.writeHead(background.status).end(await background.text())
    } catch (err) {
      res.writeHead(500).end(JSON.stringify({ message: err.cause?.message }))
    }
  })

  return server
}

export function close () {
  return server.close()
}
