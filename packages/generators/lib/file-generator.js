'use strict'
const { safeMkdir } = require('./utils')
const { join } = require('node:path')
const { writeFile } = require('node:fs/promises')

/* c8 ignore start */
const fakeLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  error: () => {}
}
/* c8 ignore start */

class FileGenerator {
  constructor (opts = {}) {
    this.files = []
    this.logger = opts.logger || fakeLogger
    this.targetDirectory = opts.targetDirectory || null
  }

  setTargetDirectory (dir) {
    this.targetDirectory = dir
  }

  addFile ({ path, file, contents, options }) {
    const fileObject = this.getFileObject(file, path)
    if (path.startsWith('/')) {
      path = path.substring(1)
    }
    if (fileObject) {
      fileObject.contents = contents
    } else {
      this.files.push({ path, file, contents, options })
    }
  }

  appendfile ({ path, file, contents }) {
    if (path.startsWith('/')) {
      path = path.substring(1)
    }
    const fileObject = this.getFileObject(file, path)
    if (fileObject) {
      fileObject.contents += `\n${contents}`
    } else {
      this.files.push({ path, file, contents })
    }
  }

  async writeFiles () {
    if (!this.targetDirectory) {
      throw new Error('No target directory set.')
    }
    await safeMkdir(this.targetDirectory)
    for (const fileToWrite of this.files) {
      if (fileToWrite.contents.length === 0) {
        continue
      }
      const baseDir = join(this.targetDirectory, fileToWrite.path)
      if (fileToWrite.path !== '') {
        await safeMkdir(baseDir)
      }
      const fullFilePath = join(baseDir, fileToWrite.file)
      await writeFile(fullFilePath, fileToWrite.contents, fileToWrite.options)
      this.logger.info(`${fullFilePath} written!`)
    }
  }

  getFileObject (name, path = '') {
    const output = this.files.find((file) => {
      return file.path === path && file.file === name
    })
    if (!output) { return null }
    return output
  }

  listFiles () {
    return this.files.map((fileObject) => {
      return join(fileObject.path, fileObject.file)
    })
  }

  reset () {
    this.files = []
  }
}

module.exports = FileGenerator
module.exports.FileGenerator = FileGenerator
