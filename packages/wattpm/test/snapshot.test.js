import { safeRemove } from '@platformatic/foundation'
import { ok, strictEqual } from 'node:assert'
import { on } from 'node:events'
import { mkdtemp, readdir, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { cliPath, executeCommand, wattpm } from './helper.js'

function wattpmInDir (cwd, ...args) {
  return executeCommand(process.argv[0], cliPath, ...args, { cwd })
}

test('heap-snapshot - should take a heap snapshot of a specific application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'heap-snapshot-test-'))

  t.after(async () => {
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
    await safeRemove(tempDir)
  })

  const startProcess = wattpm('start', rootDir)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const snapshotProcess = await wattpm('heap-snapshot', 'main', 'main', '-d', tempDir)

  strictEqual(snapshotProcess.exitCode, 0, 'Should exit with code 0')

  const files = await readdir(tempDir)
  const snapshotFiles = files.filter(file => file.startsWith('heap-main-') && file.endsWith('.heapsnapshot'))
  ok(snapshotFiles.length > 0, 'Should create a heap snapshot file')

  const snapshotFile = snapshotFiles[0]
  const stats = await stat(join(tempDir, snapshotFile))
  ok(stats.size > 0, 'Heap snapshot file should not be empty')

  // Verify it's valid JSON (V8 heap snapshots are JSON)
  const content = await readFile(join(tempDir, snapshotFile), 'utf-8')
  const parsed = JSON.parse(content)
  ok(parsed.snapshot, 'Heap snapshot should have a snapshot property')
  ok(parsed.nodes, 'Heap snapshot should have nodes')
  ok(parsed.edges, 'Heap snapshot should have edges')
  ok(parsed.strings, 'Heap snapshot should have strings')
})

test('heap-snapshot - should take heap snapshots of all applications when no application specified', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'heap-snapshot-test-'))

  t.after(async () => {
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
    await safeRemove(tempDir)
  })

  const startProcess = wattpm('start', rootDir)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const snapshotProcess = await wattpmInDir(tempDir, 'heap-snapshot', 'main')

  strictEqual(snapshotProcess.exitCode, 0, 'Should exit with code 0')

  const files = await readdir(tempDir)
  const mainSnapshots = files.filter(file => file.startsWith('heap-main-') && file.endsWith('.heapsnapshot'))
  const alternativeSnapshots = files.filter(
    file => file.startsWith('heap-alternative-') && file.endsWith('.heapsnapshot')
  )

  ok(mainSnapshots.length > 0, 'Should create a heap snapshot for main application')
  ok(alternativeSnapshots.length > 0, 'Should create a heap snapshot for alternative application')
})

test('heap-snapshot - should save to custom directory with --dir option', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'heap-snapshot-test-'))

  t.after(async () => {
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
    await safeRemove(tempDir)
  })

  const startProcess = wattpm('start', rootDir)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const snapshotProcess = await wattpm('heap-snapshot', 'main', 'main', '-d', tempDir)

  strictEqual(snapshotProcess.exitCode, 0, 'Should exit with code 0')

  const files = await readdir(tempDir)
  const snapshotFiles = files.filter(file => file.startsWith('heap-main-') && file.endsWith('.heapsnapshot'))
  ok(snapshotFiles.length > 0, 'Should create a heap snapshot file in custom directory')

  const snapshotFile = snapshotFiles[0]
  const stats = await stat(join(tempDir, snapshotFile))
  ok(stats.size > 0, 'Heap snapshot file should not be empty')

  ok(snapshotProcess.stdout.includes(tempDir), 'Output should mention the custom directory')
})

test('heap-snapshot - should fail with non-existent application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(async () => {
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
  })

  const startProcess = wattpm('start', rootDir)

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const snapshotProcess = await wattpm('heap-snapshot', 'main', 'nonexistent').catch(e => e)

  strictEqual(snapshotProcess.exitCode, 1, 'Should exit with code 1')
  ok(snapshotProcess.stdout.includes('Application not found'), 'Should report application not found')
})

test('heap-snapshot - should fail with non-existent runtime', async t => {
  const snapshotProcess = await wattpm('heap-snapshot', '999999').catch(e => e)

  strictEqual(snapshotProcess.exitCode, 1, 'Should exit with code 1')
  ok(
    snapshotProcess.stdout.includes('Cannot find a matching runtime'),
    'Should report runtime not found'
  )
})
