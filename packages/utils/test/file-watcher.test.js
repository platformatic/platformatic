'use strict'

const os = require('os')
const { mkdtemp, writeFile } = require('fs/promises')
const { join } = require('path')
const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { FileWatcher } = require('..')
const { setTimeout: sleep } = require('timers/promises')

test('should throw an error if there is no path argument', async (t) => {
  const { throws } = tspl(t, { plan: 1 })
  throws(() => new FileWatcher({}), { message: 'path option is required' })
})

test('initialize watchIgnore and allowToWatch arrays', async (t) => {
  const { deepEqual } = tspl(t, { plan: 4 })
  {
    const fileWatcher = new FileWatcher({ path: os.tmpdir() })
    deepEqual(fileWatcher.watchIgnore, null)
    deepEqual(fileWatcher.allowToWatch, null)
  }
  {
    const fileWatcher = new FileWatcher({
      path: os.tmpdir(),
      watchIgnore: ['foo'],
      allowToWatch: ['bar']
    })
    deepEqual(fileWatcher.watchIgnore, ['foo'])
    deepEqual(fileWatcher.allowToWatch, ['bar'])
  }
})

test('should not watch ignored files', async (t) => {
  const { equal } = tspl(t, { plan: 5 })

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

test('should not watch not allowed files', async (t) => {
  const { equal } = tspl(t, { plan: 5 })

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

test('should emit event if file is updated', async (t) => {
  const { ok } = tspl(t, { plan: 1 })

  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const filename = join(tmpDir, 'test.file')
  const fileWatcher = new FileWatcher({ path: tmpDir })

  let _resolve = null
  const p = new Promise((resolve) => {
    _resolve = resolve
  })

  fileWatcher.once('update', async () => {
    ok('update is emitted')
    await fileWatcher.stopWatching()
    _resolve()
  })

  fileWatcher.startWatching()
  await sleep(1000)

  await writeFile(filename, 'foobar')

  await Promise.race([sleep(5000), p])
})

test('should not call fs watch twice', async (t) => {
  const { ok } = tspl(t, { plan: 1 })

  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const filename = join(tmpDir, 'test.file')
  const fileWatcher = new FileWatcher({ path: tmpDir })

  let _resolve = null
  const p = new Promise((resolve) => {
    _resolve = resolve
  })

  fileWatcher.once('update', async () => {
    ok('update is emitted')
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
