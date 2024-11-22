/// <reference types="@platformatic/service" />
'use strict'
const { randomUUID } = require('node:crypto')
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  await fastify.register(require('@fastify/multipart'), { attachFieldsToBody: true })
  fastify.post('/formdata-movies', async (req, res) => {
    const parsedBody = {}
    Object.keys(req.body).forEach((k) => {
      parsedBody[k] = req.body[k].value.replace(/"/g, '')
    })
    return {
      id: randomUUID(),
      body: parsedBody,
      contentType: req.headers['content-type']
    }
  })
  fastify.post('/files', async (req, res) => {
    const uploadedFile = req.body.file
    const buffer = await uploadedFile.toBuffer()
    return {
      message: 'ok',
      file: buffer.toString('utf-8')
    }
  })

  fastify.post('/filesAndFields', async (req, res) => {
    const uploadedFile = req.body.file
    const buffer = await uploadedFile.toBuffer()
    const { username } = req.body
    return {
      message: 'ok',
      file: buffer.toString('utf-8'),
      username: username.value
    }
  })
}
