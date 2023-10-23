'use strict'

const build = require('pino-abstract-transport')
const fs = require('fs')
const path = require('path')

module.exports = function (opts) {
  const dest = opts.path || path.join(process.cwd(), 'transport.log')
  return build(function (source) {
    source.on('data', function (obj) {
      obj.fromTransport = true
      fs.appendFileSync(dest, JSON.stringify(obj) + '\n')
    })
  })
}
