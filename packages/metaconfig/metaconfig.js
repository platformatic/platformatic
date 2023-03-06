'use strict'

const { readFile } = require('fs').promises

async function analyze (opts) {
  if (!opts.config && !opts.file) {
    throw new Error('missing file or config to analyze')
  }

  // TODO support other formats than JSON
  const data = opts.config || JSON.parse(await readFile(opts.file, 'utf8'))

  if (!data.$schema) {
    throw new Error('missing $schema, unable to determine the version')
  }

  let Handler

  if (data.$schema.indexOf('./') === 0) {
    // We assume v0.16
    Handler = require('./versions/0.16.0.js')
  } else {
    const url = new URL(data.$schema)
    const res = url.pathname.match(/^\/schemas\/v(\d+\.\d+\.\d+)\/(.*)$/)
    if (!res) {
      throw new Error('unable to determine the version')
    }

    // The regexp should be tight enough to not worry about path
    // traversal attacks
    const version = res[1]
    Handler = require(`./versions/${version}.js`)
  }

  return new Handler(data)
}

module.exports.analyze = analyze
