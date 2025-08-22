import { createDirectory, safeRemove } from '@platformatic/foundation'
import { deepEqual, equal, fail, rejects, strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { FileGenerator } from '../lib/file-generator.js'

let dirCount = 0
describe('FileGenerator', () => {
  test('should return null if file is not found', async () => {
    const fg = new FileGenerator()
    const fileObject = fg.getFileObject('sample', 'file')
    strictEqual(null, fileObject)
  })
  test('should throw if no targeDirectory is set', async t => {
    const fg = new FileGenerator()
    rejects(async () => {
      await fg.writeFiles()
    })
  })

  test('should replace a file with same name and path', async t => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'file', contents: 'hello world' })
    fg.addFile({ path: 'path', file: 'file', contents: 'foobar' })

    const fileObject = fg.getFileObject('file', 'path')
    equal(fileObject.contents, 'foobar')
    equal(fg.files.length, 1)
  })

  test('should list files', async t => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'helloworld.txt', contents: 'hello world' })
    fg.addFile({ path: 'path', file: 'foobar.txt', contents: 'foobar' })
    fg.addFile({ path: '/anotherpath', file: 'foobar.txt', contents: 'foobar' })

    deepEqual(fg.listFiles(), [
      join('path', 'helloworld.txt'),
      join('path', 'foobar.txt'),
      join('anotherpath', 'foobar.txt')
    ])
  })
  test('should append file content', async t => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'helloworld.txt', contents: 'hello world' })

    fg.appendfile({ path: '/path', file: 'helloworld.txt', contents: 'Welcome to plaftormatic' })

    const fileObject = fg.getFileObject('helloworld.txt', 'path')
    equal(fileObject.contents, 'hello world\nWelcome to plaftormatic')

    // new file
    fg.appendfile({ path: '/path', file: 'foobar.txt', contents: 'foobar' })
    const newFileObject = fg.getFileObject('foobar.txt', 'path')
    equal(newFileObject.contents, 'foobar')
  })

  test('should reset all files', async t => {
    const fg = new FileGenerator()
    fg.addFile({ path: 'path', file: 'file', contents: 'hello world' })
    fg.addFile({ path: 'path', file: 'file', contents: 'foobar' })

    fg.reset()
    equal(fg.files.length, 0)
  })

  test('should write files', async t => {
    const tempDir = join(tmpdir(), `plt-file-generator-test-${dirCount++}`)
    t.after(async () => {
      await safeRemove(tempDir)
    })

    await createDirectory(tempDir)
    const fg = new FileGenerator()
    fg.setTargetDirectory(tempDir)
    fg.addFile({ path: 'myDir', file: 'helloworld.txt', contents: 'hello world' })

    await fg.writeFiles()
    const fileContents = await readFile(join(tempDir, 'myDir', 'helloworld.txt'), 'utf8')
    equal(fileContents, 'hello world')
  })

  test('should not write empty files', async t => {
    const tempDir = join(tmpdir(), `plt-file-generator-test-${dirCount++}`)
    t.after(async () => {
      await safeRemove(tempDir)
    })

    await createDirectory(tempDir)
    const fg = new FileGenerator()
    fg.setTargetDirectory(tempDir)
    fg.addFile({ path: 'myDir', file: 'helloworld.txt', contents: '' })

    await fg.writeFiles()
    try {
      await readFile(join(tempDir, 'myDir', 'helloworld.txt'), 'utf8')
      fail()
    } catch (err) {
      equal(err.code, 'ENOENT')
    }
  })

  test('should load file from filesystem', async t => {
    const tempDir = join(tmpdir(), `plt-file-generator-test-${dirCount++}`)
    t.after(async () => {
      await safeRemove(tempDir)
    })

    await createDirectory(tempDir)
    const fg = new FileGenerator()
    fg.setTargetDirectory(tempDir)
    fg.addFile({ path: 'myDir', file: 'helloworld.txt', contents: 'hello world' })
    await fg.writeFiles()

    fg.reset()
    const fileObject = await fg.loadFile({
      path: 'myDir',
      file: 'helloworld.txt'
    })

    deepEqual(fileObject, {
      path: 'myDir',
      file: 'helloworld.txt',
      contents: 'hello world',
      options: {},
      tags: []
    })

    equal(fg.files.length, 1)
    deepEqual(fg.files[0], {
      path: 'myDir',
      file: 'helloworld.txt',
      contents: 'hello world',
      options: {},
      tags: []
    })
  })
})
