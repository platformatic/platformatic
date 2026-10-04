// Benchmark-only overlay at packages/runtime/lib/mesh/index.js.
// A common entry module avoids adding loader threads to the stock baseline.
'use strict'
const source = process.env.MULTI_POLICY === 'stock'
  ? require('../../../../review/multi-app/stock-dependency/index.js')
  : require('./feature-index.cjs')
exports.createThreadInterceptor = source.createThreadInterceptor
exports.wire = source.wire
