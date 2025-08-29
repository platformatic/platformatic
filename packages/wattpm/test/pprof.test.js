import { ok, strictEqual } from 'node:assert'
import { on } from 'node:events'
import { readdir, stat } from 'node:fs/promises'
import { test } from 'node:test'
import split2 from 'split2'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('pprof start - should start profiling on specific service', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
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

  const pprofStartProcess = await wattpm('pprof', 'start', 'main')

  ok(
    pprofStartProcess.stdout.includes('Profiling started') || pprofStartProcess.stdout.length === 0,
    'Should start profiling successfully'
  )
  strictEqual(pprofStartProcess.exitCode, 0, 'Should exit with code 0')

  // Clean up
  await wattpm('pprof', 'stop', 'main')
})

test('pprof stop - should stop profiling and create profile file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
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

  // Start profiling
  await wattpm('pprof', 'start', 'main')

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get file
  const pprofStopProcess = await wattpm('pprof', 'stop', 'main')

  strictEqual(pprofStopProcess.exitCode, 0, 'Should exit with code 0')

  // Check that a profile file was created
  const files = await readdir(process.cwd())
  const profileFiles = files.filter(file => file.startsWith('pprof-main-') && file.endsWith('.pb'))
  ok(profileFiles.length > 0, 'Should create at least one profile file')

  // Check that the file has content
  const profileFile = profileFiles[0]
  const stats = await stat(profileFile)
  ok(stats.size > 0, 'Profile file should not be empty')
})

test('pprof start - should start profiling on all services when no service specified', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
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

  const pprofStartProcess = await wattpm('pprof', 'start')

  ok(
    pprofStartProcess.stdout.includes('Profiling started') || pprofStartProcess.stdout.length === 0,
    'Should start profiling on all services'
  )
  strictEqual(pprofStartProcess.exitCode, 0, 'Should exit with code 0')

  // Clean up
  await wattpm('pprof', 'stop')
})

test('pprof stop - should stop profiling on all services and create multiple profile files', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
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
  const files = await readdir(process.cwd())
  const profileFiles = files.filter(file => file.startsWith('pprof-') && file.endsWith('.pb'))
  ok(profileFiles.length > 0, 'Should create at least one profile file')
})

test('pprof - should handle application not found error', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.json')

  t.after(() => {
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
  ok(
    errorText.includes('Application not found') || errorText.includes('non-existent-service'),
    'Should indicate application not found'
  )
})

test('pprof - should handle no matching runtime error', async t => {
  let error
  try {
    await wattpm('pprof', 'start', 'whatever')
  } catch (e) {
    error = e
  }

  ok(error, 'Should throw an error')
  ok(
    error.stdout.includes('Cannot find a matching runtime') || error.stderr.includes('Cannot find a matching runtime'),
    'Should indicate no runtime found'
  )
})

test('pprof - should show error when no subcommand specified', async () => {
  let error
  try {
    await wattpm('pprof')
  } catch (e) {
    error = e
  }

  ok(error.stdout.includes('Please provide a pprof subcommand'))
})

test('pprof - should show error when an invalid command is specified', async () => {
  let error
  try {
    await wattpm('pprof', 'whatever')
  } catch (e) {
    error = e
  }

  ok(error.stdout.includes('Please provide a pprof subcommand'))
})
