'use strict'

const { readFile, writeFile } = require('fs').promises
const { extname } = require('path')
const YAML = require('yaml')
const TOML = require('@iarna/toml')
const JSON5 = require('json5')
const semver = require('semver')
const FromZeroEighteenToWillSee = require('./versions/from-zero-eighteen-to-will-see.js')

const ranges = [{
  range: '>= 0.18.x < 1.0.0',
  handler: FromZeroEighteenToWillSee
}]

async function analyze (opts) {
  let data
  let format
  if (opts.config) {
    data = opts.config
  } else if (opts.file) {
    const parser = getParser(opts.file)
    format = extname(opts.file).slice(1)
    data = parser(await readFile(opts.file, 'utf8'))
  } else {
    throw new Error('missing file or config to analyze')
  }

  if (!data.$schema) {
    throw new Error('missing $schema, unable to determine the version')
  }

  let Handler
  let version

  if (data.$schema.indexOf('./') === 0) {
    // We assume v0.16
    Handler = require('./versions/0.16.0.js')
  }

  if (!Handler) {
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

    version = `${major}.${minor}.${patch}`

    for (const { range, handler } of ranges) {
      if (semver.satisfies(version, range)) {
        Handler = handler
        break
      }
    }

    try {
      // try to load the exact version
      Handler ||= require(`./versions/${major}.${minor}.${patch}.js`)
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

  return new Handler({ config: data, path: opts.file, format, version })
}

module.exports.analyze = analyze

function getParser (path) {
  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      return YAML.parse
    case '.json':
      return JSON.parse
    case '.json5':
      return JSON5.parse
    case '.toml':
    case '.tml':
      return TOML.parse
    default:
      throw new Error('Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.')
  }
}

module.exports.getParser = getParser

function getStringifier (path) {
  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      return YAML.stringify
    case '.json':
      return (data) => JSON.stringify(data, null, 2)
    case '.json5':
      return (data) => JSON5.stringify(data, null, 2)
    case '.toml':
    case '.tml':
      return TOML.stringify
    default:
      throw new Error('Invalid config file extension. Only yml, yaml, json, json5, toml, tml are supported.')
  }
}

module.exports.getStringifier = getStringifier

async function write (meta) {
  const stringifier = getStringifier(meta.path)
  const toWrite = stringifier(meta.config)
  await writeFile(meta.path, toWrite)
}

module.exports.write = write

function upgrade (meta) {
  while (typeof meta.up === 'function') {
    meta = meta.up()
  }
  return meta
}

module.exports.upgrade = upgrade
