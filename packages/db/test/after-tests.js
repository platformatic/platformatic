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

  await Promise.all(filesToRemove.map(file => rm(file, removeOptions)))
}

cleanTmpDir()
