'use strict'

const collectHttpMetrics = require('@platformatic/http-metrics')
const client = require('prom-client')
const { Registry, } = client
const fp = require('fastify-plugin')

module.exports = fp(async function (_app, opts) {
  const registry = opts.registry || new Registry()
  collectHttpMetrics(registry, opts)
}, {
  name: 'http-metrics'
})
