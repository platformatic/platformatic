import express from 'express'

const app = express()

app.get('/test', (_req, res) => {
  res.send({ foo: 'internal' })
})

export function create () {
  return app
}
