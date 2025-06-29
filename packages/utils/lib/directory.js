'use strict'

const generateName = require('boring-name-generator')
const { existsSync } = require('node:fs')
const { rm, mkdir } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
let tmpCount = 0

function generateDashedName () {
  return generateName().dashed.replace(/\s+/g, '')
}

async function createDirectory (path, empty = false) {
  if (empty) {
    await safeRemove(path)
  }

  return mkdir(path, { recursive: true, maxRetries: 10, retryDelay: 1000 })
}

async function createTemporaryDirectory (prefix) {
  const directory = join(tmpdir(), `plt-utils-${prefix}-${process.pid}-${tmpCount++}`)

  return createDirectory(directory)
}

async function safeRemove (path) {
  let i = 0
  while (i++ < 10) {
    if (!existsSync(path)) {
      return
    }

    try {
      await rm(path, { force: true, recursive: true })
      break
    } catch {
      // This means that we might not delete the folder at all.
      // This is ok as we can't really trust Windows to behave.
    }
    await sleep(1000)
  }
}

module.exports = {
  createDirectory,
  createTemporaryDirectory,
  safeRemove,
  generateDashedName
}
