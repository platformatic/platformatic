'use strict'

const { test, describe } = require('node:test')
const assert = require('node:assert')
const { FileGenerator } = require('../lib/file-generator')
const { rm, readFile } = require('node:fs/promises')
const { join } = require('node:path')
const { tmpdir } = require('node:os')
const { safeMkdir } = require('../lib/utils')

let dirCount = 0
describe('FileGenerator', () => {
  test('should return null if file is not found', async () => {
    const fg = new FileGenerator()
    const fileObject = fg.getFileObject('sample', 'file')
    assert.strictEqual(null, fileObject)
  })
  test('should throw if no targeDirectory is set', async (t) => {
    const fg = new FileGenerator()
    assert.rejects(async () => {
      await fg.writeFiles()
    })
  })

  test('should replace a file with same name and path', async (t) => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'file', contents: 'hello world' })
    fg.addFile({ path: 'path', file: 'file', contents: 'foobar' })

    const fileObject = fg.getFileObject('file', 'path')
    assert.equal(fileObject.contents, 'foobar')
    assert.equal(fg.files.length, 1)
  })

  test('should list files', async (t) => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'helloworld.txt', contents: 'hello world' })
    fg.addFile({ path: 'path', file: 'foobar.txt', contents: 'foobar' })
    fg.addFile({ path: '/anotherpath', file: 'foobar.txt', contents: 'foobar' })

    assert.deepEqual(fg.listFiles(), [
      join('path', 'helloworld.txt'),
      join('path', 'foobar.txt'),
      join('anotherpath', 'foobar.txt')
    ])
  })
  test('should append file content', async (t) => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'helloworld.txt', contents: 'hello world' })

    fg.appendfile({ path: '/path', file: 'helloworld.txt', contents: 'Welcome to plaftormatic' })

    const fileObject = fg.getFileObject('helloworld.txt', 'path')
    assert.equal(fileObject.contents, 'hello world\nWelcome to plaftormatic')

    // new file
    fg.appendfile({ path: '/path', file: 'foobar.txt', contents: 'foobar' })
    const newFileObject = fg.getFileObject('foobar.txt', 'path')
    assert.equal(newFileObject.contents, 'foobar')
  })

  test('should reset all files', async (t) => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'file', contents: 'hello world' })
    fg.addFile({ path: 'path', file: 'file', contents: 'foobar' })

    fg.reset()
    assert.equal(fg.files.length, 0)
  })

  test('should write files', async (t) => {
    const tempDir = join(tmpdir(), `plt-file-generator-test-${dirCount++}`)
    t.after(async () => {
      await rm(tempDir, { recursive: true })
    })

    await safeMkdir(tempDir)
    const fg = new FileGenerator()
    fg.setTargetDirectory(tempDir)
    fg.addFile({ path: 'myDir', file: 'helloworld.txt', contents: 'hello world' })

    await fg.writeFiles()
    const fileContents = await readFile(join(tempDir, 'myDir', 'helloworld.txt'), 'utf8')
    assert.equal(fileContents, 'hello world')
  })

  test('should not write empty files', async (t) => {
    const tempDir = join(tmpdir(), `plt-file-generator-test-${dirCount++}`)
    t.after(async () => {
      await rm(tempDir, { recursive: true })
    })

    await safeMkdir(tempDir)
    const fg = new FileGenerator()
    fg.setTargetDirectory(tempDir)
    fg.addFile({ path: 'myDir', file: 'helloworld.txt', contents: '' })

    await fg.writeFiles()
    try {
      await readFile(join(tempDir, 'myDir', 'helloworld.txt'), 'utf8')
      assert.fail()
    } catch (err) {
      assert.equal(err.code, 'ENOENT')
    }
  })
})
