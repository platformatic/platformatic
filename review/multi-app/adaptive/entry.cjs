'use strict'

// Deployed only as the benchmark mesh entry overlay. Timestamp all policies.
const source = require('./feature-index.cjs')
const routing = require('./lib/request-routing')
require('../../../../review/multi-app/adaptive/policy.cjs').install(routing, require('./lib/utils'), process.env.MULTI_POLICY)

function instrument (opts) {
  const existing = opts.onClientRequest
  return { ...opts, onClientRequest: [
    ...(existing ? (Array.isArray(existing) ? existing : [existing]) : []),
    req => { req.headers['x-bench-dispatched-ns'] = String(process.hrtime.bigint()) }
  ] }
}
exports.createThreadInterceptor = opts => source.createThreadInterceptor(instrument(opts))
exports.wire = opts => source.wire(instrument(opts))
