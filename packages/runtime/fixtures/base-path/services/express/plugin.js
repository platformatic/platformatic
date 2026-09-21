'use strict'

const express = require('express')

const app = express()

app.get('/hello', (req, res) => {
  res.json({ capability: 'express' })
})

app.get('/redirect', (req, res) => {
  res.redirect('/hello')
})

app.get('/redirect-external', (req, res) => {
  res.redirect('https://example.com/oauth/authorize?client_id=123')
})

app.listen(0)
