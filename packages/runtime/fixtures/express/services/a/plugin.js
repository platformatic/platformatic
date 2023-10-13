'use strict'

const fastifyExpress = require('@fastify/express')
const express = require('express')

module.exports = async function (app) {
  const router = express.Router()

  router.use(function (req, res, next) {
    res.setHeader('x-custom', true)
    next()
  })

  router.get('/hello', (req, res) => {
    res.status(200)
    res.json({ hello: 'world' })
    process._rawDebug('hello')
  })

  await app.register(fastifyExpress)

  app.use(router)

  app.get('/hello2', (req, res) => {
    return { hello: 'world2' }
  })
}
