'use strict'

const { resolve } = require('node:path')
const { access } = require('node:fs/promises')

async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

module.exports = isFileAccessible
