'use strict'

const fp = require('fastify-plugin')
const { Pool } = require('undici')

const notAllowed = new Set([
  'content-length',
  'host',
  'connection'
])

module.exports = fp(async function (app, opts) {
  const origin = new URL(opts.url)
  const path = origin.pathname
  origin.pathname = '/'
  const pool = new Pool(origin)
  app.addHook('onClose', () => pool.close())
  app.decorateRequest('createWebhookSession', async function () {
    const headers = {}
    for (const header of Object.keys(this.headers)) {
      if (!notAllowed.has(header)) {
        headers[header] = this.headers[header]
      }
    }
    const body = JSON.stringify(this.body)
    if (body) {
      headers['content-length'] = Buffer.byteLength(body)
    }
    const res = await pool.request({
      path,
      method: 'POST',
      headers: {
        ...headers,
        'accept-encoding': 'identity'
      },
      body
    })

    if (res.statusCode > 299) {
      throw new Error('operation not allowed')
    }

    const data = await res.body.json()
    this.user = data
  })
})
