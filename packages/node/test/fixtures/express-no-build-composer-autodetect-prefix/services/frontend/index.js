import express from 'express'

globalThis.platformatic?.setServicePrefix('/nested/base/dir')

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

// This would likely fail if our code doesn't work
app.listen(1)
