import express from 'express'
import { request } from 'undici'

const app = express()

app.get('/test', (_req, res) => {
  res.send({ foo: 'bar' })
})

app.get('/internal', (_req, res) => {
  request('http://internal.plt.local/test')
    .then(async (response) => {
      const data = await response.body.text()
      res.send(data)
    })
    .catch(err => res.send(err))
})

app.listen(1)
