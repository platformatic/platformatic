'use strict'

const express = require('express')

const app = express()

app.get('/hello', (req, res) => {
  res.json({ capability: 'express' })
})

app.get('/redirect', (req, res) => {
  res.redirect('/hello')
})

app.listen(1)
