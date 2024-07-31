const { rm, mkdir } = require('node:fs/promises')

async function createDirectory (path, empty = false) {
  if (empty) {
    await safeRemove(path)
  }

  return mkdir(path, { recursive: true })
}

function safeRemove (path) {
  return rm(path, { force: true, recursive: true, maxRetries: 10, retryDelay: 500 }).catch()
}

module.exports = {
  createDirectory,
  safeRemove,
}
