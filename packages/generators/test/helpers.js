'use strict'

const { join } = require('node:path')
const fs = require('node:fs/promises')
const { safeMkdir } = require('../lib/utils')

let counter = 0

async function getTempDir (baseDir) {
  if (baseDir === undefined) {
    baseDir = __dirname
  }
  const dir = join(baseDir, 'tmp', `platformatic-generators-${process.pid}-${Date.now()}-${counter++}`)
  await safeMkdir(dir)
  return dir
}
async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const tmp = join(__dirname, 'tmp')
  try {
    await fs.mkdir(tmp)
  } catch {
  }
  const dir = await getTempDir(tmp)
  await fs.mkdir(dir)
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  if (!process.env.SKIP_RM_TMP) {
    teardown(() => fs.rm(tmp, { recursive: true }).catch(() => {}))
  }
  return dir
}

module.exports = {
  fakeLogger: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {}
  },
  getTempDir,
  moveToTmpdir
}
