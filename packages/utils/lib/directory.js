const { rm, mkdir } = require('node:fs/promises')

async function createDirectory (path, empty = false) {
  if (empty) {
    await safeRemove(path)
  }

  return mkdir(path, { recursive: true, maxRetries: 10, retryDelay: 1000 })
}

function safeRemove (path) {
  return rm(path, { force: true, recursive: true, maxRetries: 10, retryDelay: 1000 }).catch()
}

module.exports = {
  createDirectory,
  safeRemove,
}
