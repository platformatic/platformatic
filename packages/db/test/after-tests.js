'use strict'

const { join } = require('path')
const { readdir } = require('fs/promises')
const { safeRemove } = require('@platformatic/utils')

const TMP_DIR_PATH = join(__dirname, '../../../tmp')

async function cleanTmpDir () {
  const filenames = await readdir(TMP_DIR_PATH)
  const filesToRemove = filenames
    .filter(filename => !['.gitkeep', '.gitignore'].includes(filename))
    .map(filename => join(TMP_DIR_PATH, filename))

  const results = await Promise.allSettled(filesToRemove.map(file => safeRemove(file)))

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      console.error(`Failed to remove ${filesToRemove[i]}`)
      console.error(result.reason)
    }
  }
}

cleanTmpDir()

setTimeout(() => {
  console.error('we are not cleaning up everything, took too long')
  process.exit(0)
}, 10_000).unref()
