import express from 'express'

export function build () {
  globalThis.platformatic?.setBasePath('/nested/base/dir')

  const app = express()

  app.get('/nested/base/dir/', (req, res) => {
    res.send({ production: process.env.NODE_ENV === 'production' })
  })

  app.get('/nested/base/dir/direct', (req, res) => {
    res.send({ ok: true })
  })

  app.get('/nested/base/dir/time', (req, res) => {
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
