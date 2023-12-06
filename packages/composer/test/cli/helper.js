'use strict'

const { on } = require('events')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { mkdtemp, rm } = require('node:fs/promises')

const split = require('split2')
const { Agent, setGlobalDispatcher } = require('undici')

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
}))

const cliPath = join(__dirname, '..', '..', 'composer.mjs')

async function start (...args) {
  const { execa } = await import('execa')

  const child = execa('node', [cliPath, 'start', ...args])
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
  }, 30000)

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

async function tmpDir (t, name) {
  const cwd = await mkdtemp(join(tmpdir(), name))
  t.after(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  return cwd
}

module.exports = { start, tmpDir, cliPath }
