'use strict'

const { join } = require('path')
const { rm, readdir } = require('fs/promises')

const TMP_DIR_PATH = join(__dirname, 'tmp')

async function cleanTmpDir () {
  const filenames = await readdir(TMP_DIR_PATH)
  const filesToRemove = filenames
    .filter(filename => filename !== '.gitkeep')
    .map(filename => join(TMP_DIR_PATH, filename))

  const removeOptions = {
    force: true,
    recursive: true,
    maxRetries: 10,
    retryDelay: 1000
  }

  const results = await Promise.allSettled(filesToRemove.map(file => rm(file, removeOptions)))

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      console.error(`Failed to remove ${filesToRemove[i]}`)
      console.error(result.reason)
    }
  }
}

cleanTmpDir()
