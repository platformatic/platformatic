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
    const res = url.pathname.match(/^\/schemas\/v(\d+)\.(\d+)\.(\d+)\/(.*)$/)
    if (!res) {
      throw new Error('unable to determine the version')
    }

    // The regexp should be tight enough to not worry about path
    // traversal attacks

    const major = res[1]
    const minor = res[2]
    const patch = res[3]

    try {
      // try to load the exact version
      Handler = require(`./versions/${major}.${minor}.${patch}.js`)
    } catch {}

    try {
      // try to load the path range
      Handler ||= require(`./versions/${major}.${minor}.x.js`)
    } catch {}

    try {
      // try to load the minor range
      Handler ||= require(`./versions/${major}.x.x.js`)
    } catch {}

    if (!Handler) {
      throw new Error('unable to determine the version')
    }
  }

  return new Handler(data)
}

module.exports.analyze = analyze
