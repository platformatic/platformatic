import { cleanBasePath, ensureTrailingSlash } from '@platformatic/basic'
import express from 'express'

export function build () {
  const app = express()
  const prefix = globalThis.platformatic?.basePath ?? ''

  app.get(ensureTrailingSlash(cleanBasePath(prefix)), (req, res) => {
    res.send({ production: process.env.NODE_ENV === 'production' })
  })

  app.get(cleanBasePath(`${prefix}/direct`), (req, res) => {
    res.send({ ok: true })
  })

  app.get(cleanBasePath(`${prefix}/time`), (req, res) => {
    fetch('http://backend.plt.local/time')
      .then(response => response.json())
      .then(json => {
        res.writeHead(200, {
          'content-type': 'application/json',
          connection: 'close'
        })
        res.end(JSON.stringify(json))
      })
  })

  return app
}
