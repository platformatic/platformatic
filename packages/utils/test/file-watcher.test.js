'use strict'

const os = require('os')
const { mkdtemp, writeFile } = require('fs/promises')
const { join } = require('path')
const { test } = require('tap')
const { FileWatcher } = require('..')
const { setTimeout: sleep } = require('timers/promises')

test('should throw an error if there is no path argument', async ({ throws, plan }) => {
  plan(1)
  throws(() => new FileWatcher({}), 'path option is required')
})

test('initialize watchIgnore and allowToWatch arrays', async ({ same, plan }) => {
  plan(4)
  {
    const fileWatcher = new FileWatcher({ path: os.tmpdir() })
    same(fileWatcher.watchIgnore, null)
    same(fileWatcher.allowToWatch, null)
  }
  {
    const fileWatcher = new FileWatcher({
      path: os.tmpdir(),
      watchIgnore: ['foo'],
      allowToWatch: ['bar']
    })
    same(fileWatcher.watchIgnore, ['foo'])
    same(fileWatcher.allowToWatch, ['bar'])
  }
})

test('should not watch ignored files', async ({ equal, plan }) => {
  const fileWatcher = new FileWatcher({
    path: os.tmpdir(),
    watchIgnore: ['test.file', 'test2.file', './test3.file', '.\\test4.file']
  })
  equal(false, fileWatcher.shouldFileBeWatched('test.file'))
  equal(false, fileWatcher.shouldFileBeWatched('test2.file'))
  equal(false, fileWatcher.shouldFileBeWatched('test3.file'))
  equal(false, fileWatcher.shouldFileBeWatched('test4.file'))
  equal(true, fileWatcher.shouldFileBeWatched('another.file'))
})

test('should not watch not allowed files', async ({ equal, plan }) => {
  const fileWatcher = new FileWatcher({
    path: os.tmpdir(),
    allowToWatch: ['test.file', 'test2.file', './test3.file', '.\\test4.file']
  })
  equal(true, fileWatcher.shouldFileBeWatched('test.file'))
  equal(true, fileWatcher.shouldFileBeWatched('test2.file'))
  equal(true, fileWatcher.shouldFileBeWatched('test3.file'))
  equal(true, fileWatcher.shouldFileBeWatched('test4.file'))
  equal(false, fileWatcher.shouldFileBeWatched('another.file'))
})

test('should emit event if file is updated', async ({ end, pass }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const filename = join(tmpDir, 'test.file')
  const fileWatcher = new FileWatcher({ path: tmpDir })

  let _resolve = null
  const p = new Promise((resolve) => {
    _resolve = resolve
  })

  fileWatcher.once('update', async () => {
    pass('update is emitted')
    await fileWatcher.stopWatching()
    _resolve()
  })

  fileWatcher.startWatching()
  await sleep(1000)

  await writeFile(filename, 'foobar')

  await Promise.race([sleep(5000), p])
})

test('should not call fs watch twice', async ({ pass, plan }) => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const filename = join(tmpDir, 'test.file')
  const fileWatcher = new FileWatcher({ path: tmpDir })

  let _resolve = null
  const p = new Promise((resolve) => {
    _resolve = resolve
  })

  fileWatcher.once('update', async () => {
    pass('update is emitted')
    await fileWatcher.stopWatching()
    await fileWatcher.stopWatching()
    _resolve()
  })

  fileWatcher.startWatching()
  fileWatcher.startWatching()
  await sleep(1000)

  await writeFile(filename, 'foobar')
  await Promise.race([sleep(5000), p])
})
