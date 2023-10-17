'use strict'

const { join } = require('node:path')
const { setTimeout } = require('node:timers/promises')
const { on } = require('node:events')
const why = require('why-is-node-running')
const { Agent, setGlobalDispatcher } = require('undici')
const { createConnectionPool } = require('@platformatic/sql-mapper')
const split = require('split2')

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
setInterval(() => {
  why()
}, 20000).unref()

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
}))

const cliPath = join(__dirname, '..', '..', 'db.mjs')

async function connectDB (connectionInfo) {
  const { db } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {},
      error: () => {}
    },
    max: 1,
    ...connectionInfo
  })
  return db
}

function removeFileProtocol (str) {
  return str.replace('file:', '')
}

function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return removeFileProtocol(join(__dirname, '..', 'fixtures', ...subdirectories, filename))
}

async function start (commandOpts, exacaOpts = {}) {
  const { execa } = await import('execa')
  const child = execa('node', [cliPath, 'start', ...commandOpts], exacaOpts)
  child.stderr.pipe(process.stdout)
  const output = child.stdout.pipe(split(function (line) {
    try {
      const obj = JSON.parse(line)
      return obj
    } catch (err) {
      console.log(line)
    }
  }))
  child.ndj = output

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 10000)

  for await (const messages of on(output, 'data')) {
    for (const message of messages) {
      const text = message.msg
      if (text && text.includes('Server listening at')) {
        const url = text.match(/Server listening at (.*)/)[1]
        clearTimeout(errorTimeout)
        return { child, url, output }
      }
    }
  }
}

function parseEnv (envFile) {
  const env = {}
  for (const line of envFile.split('\n')) {
    if (line) {
      const [key, value] = line.split('=')
      env[key.trim()] = value.trim()
    }
  }
  return env
}

module.exports.cliPath = cliPath
module.exports.connectDB = connectDB
module.exports.getFixturesConfigFileLocation = getFixturesConfigFileLocation
module.exports.start = start
module.exports.parseEnv = parseEnv
