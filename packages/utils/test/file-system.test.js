import { deepEqual, equal, match, ok, throws } from 'node:assert'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { basename, join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  createDirectory,
  createTemporaryDirectory,
  FileWatcher,
  generateDashedName,
  hasFilesWithExtensions,
  hasJavascriptFiles,
  isFileAccessible,
  removeDotSlash,
  safeRemove,
  searchFilesWithExtensions,
  searchJavascriptFiles
} from '../index.js'

test('FileWatcher - should throw an error if there is no path argument', async t => {
  throws(() => new FileWatcher({}), { message: 'path option is required' })
})

test('FileWatcher - initialize watchIgnore and allowToWatch arrays', async t => {
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

test('FileWatcher - should not watch ignored files', async t => {
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

test('FileWatcher - should not watch not allowed files', async t => {
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

test('FileWatcher - should emit event if file is updated', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const filename = join(tmpDir, 'test.file')
  const fileWatcher = new FileWatcher({ path: tmpDir })

  const { promise, resolve } = Promise.withResolvers()

  fileWatcher.once('update', async () => {
    ok('update is emitted')
    await fileWatcher.stopWatching()
    resolve()
  })

  fileWatcher.startWatching()
  await sleep(1000)

  await writeFile(filename, 'foobar')

  await Promise.race([sleep(5000), promise])
})

test('FileWatcher - should not call fs watch twice', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const filename = join(tmpDir, 'test.file')
  const fileWatcher = new FileWatcher({ path: tmpDir })

  const { promise, resolve } = Promise.withResolvers()

  fileWatcher.once('update', async () => {
    ok('update is emitted')
    await fileWatcher.stopWatching()
    await fileWatcher.stopWatching()
    resolve()
  })

  fileWatcher.startWatching()
  fileWatcher.startWatching()
  await sleep(1000)

  await writeFile(filename, 'foobar')
  await Promise.race([sleep(5000), promise])
})

test('isFileAccessible', async t => {
  {
    // single filename
    const file = basename(import.meta.filename)
    deepEqual(await isFileAccessible(file, import.meta.dirname), true)
    deepEqual(await isFileAccessible('impossible.file', import.meta.dirname), false)
  }

  {
    // full path
    const file = import.meta.filename
    deepEqual(await isFileAccessible(file), true)
    deepEqual(await isFileAccessible('/impossible/path/impossible.file'), false)
  }
})

test('removeDotSlash - should remove leading dot-slash patterns', () => {
  equal(removeDotSlash('./test/file.js'), 'test/file.js')
  equal(removeDotSlash('.\\test\\file.js'), 'test\\file.js')
  equal(removeDotSlash('test/file.js'), 'test/file.js')
  equal(removeDotSlash('/absolute/path.js'), '/absolute/path.js')
  equal(removeDotSlash(''), '')
})

test('generateDashedName - should generate a valid dashed name', () => {
  const name = generateDashedName()
  ok(typeof name === 'string')
  ok(name.length > 0)
  ok(!name.includes(' '))
  match(name, /^[a-z-]+$/)
})

test('createDirectory - should create directory recursively', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const nestedPath = join(tmpDir, 'nested', 'deep', 'directory')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  await createDirectory(nestedPath)
  ok(existsSync(nestedPath))
})

test('createDirectory - should remove existing directory when empty=true', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  const testPath = join(tmpDir, 'test-dir')

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  // Create directory and file
  await mkdir(testPath, { recursive: true })
  await writeFile(join(testPath, 'existing.txt'), 'content')
  ok(existsSync(join(testPath, 'existing.txt')))

  // Recreate with empty=true should remove existing content
  await createDirectory(testPath, true)
  ok(existsSync(testPath))
  ok(!existsSync(join(testPath, 'existing.txt')))
})

test('createTemporaryDirectory - should create unique temporary directory', async t => {
  const dir1 = await createTemporaryDirectory('test1')
  const dir2 = await createTemporaryDirectory('test2')

  t.after(async () => {
    await safeRemove(dir1)
    await safeRemove(dir2)
  })

  ok(existsSync(dir1))
  ok(existsSync(dir2))
  ok(dir1 !== dir2)
  ok(dir1.includes('plt-utils-test1'))
  ok(dir2.includes('plt-utils-test2'))
})

test('safeRemove - should remove existing directory', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))
  await writeFile(join(tmpDir, 'test.txt'), 'content')
  ok(existsSync(tmpDir))

  await safeRemove(tmpDir)
  ok(!existsSync(tmpDir))
})

test('safeRemove - should handle non-existent path gracefully', async t => {
  const nonExistentPath = join(os.tmpdir(), 'non-existent-' + Math.random())
  await safeRemove(nonExistentPath) // Should not throw
})

test('safeRemove - should retry on Windows filesystem issues', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  // Create a deeply nested structure to potentially trigger Windows issues
  const deepPath = join(tmpDir, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j')
  await mkdir(deepPath, { recursive: true })

  // Create multiple files to make removal potentially more complex
  for (let i = 0; i < 10; i++) {
    await writeFile(join(deepPath, `file${i}.txt`), 'content')
  }

  ok(existsSync(tmpDir))
  await safeRemove(tmpDir)
  ok(!existsSync(tmpDir))
})

test('searchFilesWithExtensions - should find files with given extensions', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  // Create test files
  await writeFile(join(tmpDir, 'test.js'), 'content')
  await writeFile(join(tmpDir, 'test.ts'), 'content')
  await writeFile(join(tmpDir, 'test.txt'), 'content')
  await mkdir(join(tmpDir, 'subdir'), { recursive: true })
  await writeFile(join(tmpDir, 'subdir', 'nested.js'), 'content')

  const jsFiles = await searchFilesWithExtensions(tmpDir, 'js')
  equal(jsFiles.length, 2)
  ok(jsFiles.includes('test.js'))
  ok(jsFiles.includes('subdir/nested.js'))

  const multipleExt = await searchFilesWithExtensions(tmpDir, ['js', 'ts'])
  equal(multipleExt.length, 3)
  ok(multipleExt.includes('test.js'))
  ok(multipleExt.includes('test.ts'))
  ok(multipleExt.includes('subdir/nested.js'))
})

test('searchJavascriptFiles - should find JavaScript and TypeScript files', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  // Create test files
  await writeFile(join(tmpDir, 'test.js'), 'content')
  await writeFile(join(tmpDir, 'test.mjs'), 'content')
  await writeFile(join(tmpDir, 'test.cjs'), 'content')
  await writeFile(join(tmpDir, 'test.ts'), 'content')
  await writeFile(join(tmpDir, 'test.mts'), 'content')
  await writeFile(join(tmpDir, 'test.cts'), 'content')
  await writeFile(join(tmpDir, 'test.txt'), 'content')

  // Create node_modules (should be ignored)
  await mkdir(join(tmpDir, 'node_modules'), { recursive: true })
  await writeFile(join(tmpDir, 'node_modules', 'ignored.js'), 'content')

  const jsFiles = await searchJavascriptFiles(tmpDir)

  // Filter out any files that might include node_modules (to be safe)
  const filteredFiles = jsFiles.filter(f => !f.includes('node_modules'))

  ok(filteredFiles.includes('test.js'))
  ok(filteredFiles.includes('test.mjs'))
  ok(filteredFiles.includes('test.cjs'))
  ok(filteredFiles.includes('test.ts'))
  ok(filteredFiles.includes('test.mts'))
  ok(filteredFiles.includes('test.cts'))
  ok(!filteredFiles.includes('test.txt'))
  // Should only include the 6 JS/TS files we created
  equal(
    filteredFiles.filter(f => ['test.js', 'test.mjs', 'test.cjs', 'test.ts', 'test.mts', 'test.cts'].includes(f))
      .length,
    6
  )
})

test('hasFilesWithExtensions - should return true when files with extensions exist', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  equal(await hasFilesWithExtensions(tmpDir, 'js'), false)

  await writeFile(join(tmpDir, 'test.js'), 'content')
  equal(await hasFilesWithExtensions(tmpDir, 'js'), true)
  equal(await hasFilesWithExtensions(tmpDir, 'ts'), false)
})

test('hasJavascriptFiles - should return true when JavaScript files exist', async t => {
  const tmpDir = await mkdtemp(join(os.tmpdir(), 'plt-utils-test-'))

  t.after(async () => {
    await safeRemove(tmpDir)
  })

  equal(await hasJavascriptFiles(tmpDir), false)

  await writeFile(join(tmpDir, 'test.js'), 'content')
  equal(await hasJavascriptFiles(tmpDir), true)
})

test('FileWatcher - should ignore node_modules by default', async t => {
  const fileWatcher = new FileWatcher({ path: os.tmpdir() })
  equal(fileWatcher.shouldFileBeWatched('node_modules/package/file.js'), false)
  equal(fileWatcher.shouldFileBeWatched('node_modules'), false)
  equal(fileWatcher.shouldFileBeWatched('regular-file.js'), true)
  // Files in subdirs containing node_modules should still be watched
  equal(fileWatcher.shouldFileBeWatched('src/node_modules/file.js'), true)
})

test('FileWatcher - should handle allowToWatch with duplicates', async t => {
  const fileWatcher = new FileWatcher({
    path: os.tmpdir(),
    allowToWatch: ['test.file', 'test.file', './test2.file']
  })
  // Should deduplicate allowToWatch array
  equal(fileWatcher.allowToWatch.length, 2)
  ok(fileWatcher.allowToWatch.includes('test.file'))
  ok(fileWatcher.allowToWatch.includes('test2.file'))
})

test('FileWatcher - should handle watchIgnore with duplicates', async t => {
  const fileWatcher = new FileWatcher({
    path: os.tmpdir(),
    watchIgnore: ['ignore.file', 'ignore.file', './ignore2.file']
  })
  // Should deduplicate watchIgnore array
  equal(fileWatcher.watchIgnore.length, 2)
  ok(fileWatcher.watchIgnore.includes('ignore.file'))
  ok(fileWatcher.watchIgnore.includes('ignore2.file'))
})
