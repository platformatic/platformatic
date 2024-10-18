'use strict'

const { setGlobalDispatcher, Agent, request } = require('undici')
const { join } = require('path')
const { createDirectory, safeRemove } = require('@platformatic/utils')

setGlobalDispatcher(
  new Agent({
    keepAliveMaxTimeout: 1,
    keepAliveTimeout: 1
  })
)

module.exports.request = request

let counter = 0

async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const tmp = join(__dirname, 'tmp')
  try {
    await createDirectory(tmp)
  } catch {}
  const dir = join(tmp, `platformatic-client-${process.pid}-${Date.now()}-${counter++}`)
  await createDirectory(dir)
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => safeRemove(tmp))
  }
  return dir
}

module.exports.moveToTmpdir = moveToTmpdir
module.exports.cliPath = join(__dirname, '..', 'cli.mjs')
