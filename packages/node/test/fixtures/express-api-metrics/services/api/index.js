import express from 'express'
const app = express()
app.get('/test', (_req, res) => {
  res.send({ foo: 'bar' })
})

app.listen(1)
