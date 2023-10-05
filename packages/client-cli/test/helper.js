'use strict'

const { join } = require('node:path')
const fs = require('node:fs/promises')
const { setGlobalDispatcher, Agent, request } = require('undici')

setGlobalDispatcher(new Agent({
  keepAliveMaxTimeout: 1,
  keepAliveTimeout: 1
}))

module.exports.request = request

let counter = 0

async function moveToTmpdir (t) {
  const cwd = process.cwd()
  const tmp = join(__dirname, 'tmp')
  try {
    await fs.mkdir(tmp)
  } catch {
  }
  const dir = join(tmp, `platformatic-client-${process.pid}-${Date.now()}-${counter++}`)
  await fs.mkdir(dir)
  process.chdir(dir)
  t.after(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    t.after(() => fs.rm(tmp, { recursive: true }).catch(() => {}))
  }
  return dir
}

module.exports.moveToTmpdir = moveToTmpdir
module.exports.cliPath = join(__dirname, '..', 'cli.mjs')
