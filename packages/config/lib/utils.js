'use strict'

const { resolve } = require('path')
const { access } = require('fs/promises')

async function isFileAccessible (filename, directory) {
  try {
    const filePath = resolve(directory, filename)
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

module.exports.isFileAccessible = isFileAccessible
