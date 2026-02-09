import { createDirectory } from '@platformatic/foundation'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'

/* c8 ignore start */
const fakeLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  error: () => {}
}
/* c8 ignore start */

export class FileGenerator {
  constructor (opts = {}) {
    this.files = []
    this.logger = opts.logger || fakeLogger
    this.targetDirectory = opts.targetDirectory || null
  }

  setTargetDirectory (dir) {
    this.targetDirectory = dir
  }

  async loadFile ({ path, file }) {
    const filePath = join(this.targetDirectory, path, file)
    const contents = await readFile(filePath, 'utf-8')
    this.addFile({ path, file, contents })
    return this.getFileObject(file, path)
  }

  addFile ({ path, file, contents, options = {}, tags }) {
    const fileObject = this.getFileObject(file, path)
    if (path.startsWith('/')) {
      path = path.substring(1)
    }
    if (fileObject) {
      fileObject.contents = contents
      fileObject.tags = tags ?? []
    } else {
      this.files.push({ path, file, contents, options, tags: tags ?? [] })
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
    await createDirectory(this.targetDirectory)
    for (const fileToWrite of this.files) {
      if (fileToWrite.contents.length === 0 && !fileToWrite.file.match(/^\..+keep$/)) {
        continue
      }

      let fullFilePath = join(fileToWrite.path, fileToWrite.file)

      if (!isAbsolute(fullFilePath)) {
        fullFilePath = join(this.targetDirectory, fullFilePath)
      }

      await createDirectory(dirname(fullFilePath))
      await writeFile(fullFilePath, fileToWrite.contents, fileToWrite.options)

      this.logger.info(`${fullFilePath} written!`)
    }
  }

  getFileObject (name, path = '') {
    const output = this.files.find(file => {
      return file.path === path && file.file === name
    })
    if (!output) {
      return null
    }
    return output
  }

  listFiles () {
    return this.files.map(fileObject => {
      return join(fileObject.path, fileObject.file)
    })
  }

  reset () {
    this.files = []
  }
}
