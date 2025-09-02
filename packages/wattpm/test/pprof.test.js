import { ok, strictEqual } from 'node:assert'
import { readdir, stat, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { on } from 'node:events'
import { test } from 'node:test'
import split2 from 'split2'
import { safeRemove } from '@platformatic/utils'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm, executeCommand, cliPath } from './helper.js'

// Custom wattpm function that accepts cwd option
function wattpmInDir (cwd, ...args) {
  return executeCommand(process.argv[0], cliPath, ...args, { cwd })
}

test('pprof start - should start profiling on specific service', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

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

  const pprofStartProcess = await wattpmInDir(tempDir, 'pprof', 'start', 'main')

  ok(pprofStartProcess.stdout.includes('Profiling started') || pprofStartProcess.stdout.length === 0, 'Should start profiling successfully')
  strictEqual(pprofStartProcess.exitCode, 0, 'Should exit with code 0')

  // Clean up
  await wattpmInDir(tempDir, 'pprof', 'stop', 'main')
})

test('pprof stop - should stop profiling and create profile file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

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

  // Start profiling
  await wattpmInDir(tempDir, 'pprof', 'start', 'main')

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get file
  const pprofStopProcess = await wattpmInDir(tempDir, 'pprof', 'stop', 'main')

  strictEqual(pprofStopProcess.exitCode, 0, 'Should exit with code 0')

  // Check that a profile file was created
  const files = await readdir(tempDir)
  const profileFiles = files.filter(file => file.startsWith('pprof-main-') && file.endsWith('.pb'))
  ok(profileFiles.length > 0, 'Should create at least one profile file')

  // Check that the file has content
  const profileFile = profileFiles[0]
  const stats = await stat(join(tempDir, profileFile))
  ok(stats.size > 0, 'Profile file should not be empty')
})

test('pprof start - should start profiling on all services when no service specified', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const cwd = process.cwd()
  process.chdir(rootDir)

  t.after(async () => {
    // Clean up
    await wattpm('pprof', 'stop')

    process.chdir(cwd)
    startProcess.kill('SIGINT')
    startProcess.catch(() => {})
  })

  const startProcess = wattpm('start')

  for await (const log of on(startProcess.stdout.pipe(split2()), 'data')) {
    const parsed = JSON.parse(log.toString())

    if (parsed.msg.startsWith('Platformatic is now listening')) {
      break
    }
  }

  const pprofStartProcess = await wattpm('pprof', 'start')

  ok(pprofStartProcess.stdout.includes('Profiling started') || pprofStartProcess.stdout.length === 0, 'Should start profiling on all services')
  strictEqual(pprofStartProcess.exitCode, 0, 'Should exit with code 0')
})

test('pprof stop - should stop profiling on all services and create multiple profile files', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  const cwd = process.cwd()
  process.chdir(rootDir)

  t.after(async () => {
    process.chdir(cwd)
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

  // Start profiling on all services
  await wattpm('pprof', 'start')

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get files
  const pprofStopProcess = await wattpm('pprof', 'stop')

  strictEqual(pprofStopProcess.exitCode, 0, 'Should exit with code 0')

  // Check that profile files were created
  const files = await readdir(rootDir)
  const profileFiles = files.filter(file => file.startsWith('pprof-') && file.endsWith('.pb'))
  ok(profileFiles.length > 0, 'Should create at least one profile file')
})

test('pprof - should handle service not found error', async t => {
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

  let error
  try {
    await wattpm('pprof', 'start', 'non-existent-service')
  } catch (e) {
    error = e
  }

  ok(error, 'Should throw an error')
  const errorText = error.stdout + error.stderr
  ok(errorText.includes('Service not found') || errorText.includes('non-existent-service'), 'Should indicate service not found')
})

test('pprof - should handle no matching runtime error', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

  t.after(async () => {
    await safeRemove(tempDir)
  })

  let error
  try {
    await wattpmInDir(tempDir, 'pprof', 'start')
  } catch (e) {
    error = e
  }

  ok(error, 'Should throw an error')
  ok(error.stdout.includes('Cannot find a matching runtime') || error.stderr.includes('Cannot find a matching runtime'), 'Should indicate no runtime found')
})

test('pprof - should show help when no subcommand specified', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

  t.after(async () => {
    await safeRemove(tempDir)
  })

  let error
  try {
    await wattpmInDir(tempDir, 'pprof')
  } catch (e) {
    error = e
  }

  ok(error, 'Should show help and exit with error')
  ok(error.stdout.includes('pprof start') || error.stdout.includes('pprof stop'), 'Should show pprof help')
})

test('pprof start - should start profiling with explicit runtime id and service', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

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

  // Get the running process info to use as explicit runtime id
  const psProcess = await wattpm('ps')
  const psLines = psProcess.stdout.split('\n')
  const runtimeLine = psLines.find(line => line.includes('main'))
  ok(runtimeLine, 'Should find runtime in ps output')

  // Extract PID from table output - skip table border characters and get first numeric value
  const runtimeId = runtimeLine.match(/\d+/)[0] // Extract first number (PID) from table row

  const pprofStartProcess = await wattpmInDir(tempDir, 'pprof', 'start', runtimeId, 'main')

  ok(pprofStartProcess.stdout.includes('Profiling started') || pprofStartProcess.stdout.length === 0, 'Should start profiling with explicit runtime id')
  strictEqual(pprofStartProcess.exitCode, 0, 'Should exit with code 0')

  // Clean up
  await wattpmInDir(tempDir, 'pprof', 'stop', runtimeId, 'main')
})

test('pprof stop - should stop profiling with explicit runtime id and service', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

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

  // Get the running process info to use as explicit runtime id
  const psProcess = await wattpm('ps')
  const psLines = psProcess.stdout.split('\n')
  const runtimeLine = psLines.find(line => line.includes('main'))
  ok(runtimeLine, 'Should find runtime in ps output')

  // Extract PID from table output - skip table border characters and get first numeric value
  const runtimeId = runtimeLine.match(/\d+/)[0] // Extract first number (PID) from table row

  // Start profiling with explicit runtime id
  await wattpmInDir(tempDir, 'pprof', 'start', runtimeId, 'main')

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling with explicit runtime id
  const pprofStopProcess = await wattpmInDir(tempDir, 'pprof', 'stop', runtimeId, 'main')

  strictEqual(pprofStopProcess.exitCode, 0, 'Should exit with code 0')

  // Check that a profile file was created
  const files = await readdir(tempDir)
  const profileFiles = files.filter(file => file.startsWith('pprof-main-') && file.endsWith('.pb'))
  ok(profileFiles.length > 0, 'Should create at least one profile file')

  // Check that the file has content
  const profileFile = profileFiles[0]
  const stats = await stat(join(tempDir, profileFile))
  ok(stats.size > 0, 'Profile file should not be empty')
})

test('pprof - should handle invalid runtime id error', async t => {
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

  t.after(async () => {
    await safeRemove(tempDir)
  })

  let error
  try {
    await wattpmInDir(tempDir, 'pprof', 'start', 'invalid-runtime-id', 'main')
  } catch (e) {
    error = e
  }

  ok(error, 'Should throw an error')
  ok(error.stdout.includes('Cannot find a matching runtime') || error.stderr.includes('Cannot find a matching runtime'), 'Should indicate runtime not found')
})

test('pprof - should handle service not found with explicit runtime id', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')
  const tempDir = await mkdtemp(join(tmpdir(), 'pprof-test-'))

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

  // Get the running process info to use as explicit runtime id
  const psProcess = await wattpm('ps')
  const psLines = psProcess.stdout.split('\n')
  const runtimeLine = psLines.find(line => line.includes('main'))
  ok(runtimeLine, 'Should find runtime in ps output')

  // Extract PID from table output - skip table border characters and get first numeric value
  const runtimeId = runtimeLine.match(/\d+/)[0] // Extract first number (PID) from table row

  let error
  try {
    await wattpmInDir(tempDir, 'pprof', 'start', runtimeId, 'non-existent-service')
  } catch (e) {
    error = e
  }

  ok(error, 'Should throw an error')
  const errorText = error.stdout + error.stderr
  ok(errorText.includes('Service not found') || errorText.includes('non-existent-service'), 'Should indicate service not found')
})
