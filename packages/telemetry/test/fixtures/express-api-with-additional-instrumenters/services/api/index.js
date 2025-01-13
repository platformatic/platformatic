const express = require('express')

const app = express()

app.use(express.json())

app.get('/test', (_req, res) => {
  res.send({ foo: 'bar' })
})

app.listen(1)
