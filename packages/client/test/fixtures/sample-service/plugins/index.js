/// <reference types="@platformatic/service" />
'use strict'
const { randomUUID } = require('node:crypto')
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  let parsedBody = {}
  fastify.addContentTypeParser('multipart/form-data', { parseAs: 'string' }, async (req, payload) => {
    const body = {}
    let nextIsData = false
    let currentKey
    let currentValue
    const arr = payload.split('\n')
    arr.forEach((line, idx) => {
      let delimiter = ''
      if (idx === 0) { // delimiter
        delimiter = line
      } else {
        if (nextIsData) {
          const match = line.match(/"(.*)"/)
          currentValue = match[1]
          body[currentKey] = currentValue
          currentKey = null
          currentValue = null
          nextIsData = false
        }
        if (line.match(/Content-Disposition: form-data;/)) {
          // get the key
          const match = line.match(/name="(.*)"/)
          currentKey = match[1]
        }
        if (line.length === 1) {
          nextIsData = true
        }
        if (line === `${delimiter}--`) {
          // end of body
        }
      }
    })

    req.body = body
    parsedBody = body
  })
  fastify.post('/formdata-movies', async (req, res) => {
    // const { title } = req.body
    return {
      id: randomUUID(),
      body: parsedBody,
      contentType: req.headers['content-type']
    }
  })
}
