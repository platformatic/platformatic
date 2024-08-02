'use strict'

const { rm, mkdir } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')

async function createDirectory (path, empty = false) {
  if (empty) {
    await safeRemove(path)
  }

  return mkdir(path, { recursive: true, maxRetries: 10, retryDelay: 1000 })
}

async function safeRemove (path) {
  let i = 0
  while (i++ < 10) {
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
  safeRemove,
}
