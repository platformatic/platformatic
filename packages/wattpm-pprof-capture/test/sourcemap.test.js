import assert from 'node:assert'
import { resolve } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'
import { request } from 'undici'
import { Profile } from 'pprof-format'
import { createRuntime } from '../../runtime/test/helpers.js'

const execAsync = promisify(exec)

// Helper to wait for a condition to be true
async function waitForCondition (checkFn, timeoutMs = 5000, pollMs = 100) {
  const startTime = Date.now()
  while (Date.now() - startTime < timeoutMs) {
    if (await checkFn()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, pollMs))
  }
  throw new Error('Timeout waiting for condition')
}

// Helper to verify TypeScript files are present in profile
function verifyTypeScriptFilesInProfile (profile) {
  let foundTypeScriptFile = false
  const allFilenames = new Set()

  for (const func of profile.function) {
    const id = Number(func.filename)
    const filename = profile.stringTable.strings[id] || ''
    if (filename) {
      allFilenames.add(filename)
      if (filename.endsWith('.ts')) {
        foundTypeScriptFile = true
      }
    }
  }

  const filenameList = Array.from(allFilenames).sort()
  console.error(`[CI-LOG-VERIFY] Found ${allFilenames.size} unique filenames in profile:`)
  for (const filename of filenameList) {
    console.error(`[CI-LOG-VERIFY]   - ${filename}`)
  }
  console.error(`[CI-LOG-VERIFY] foundTypeScriptFile: ${foundTypeScriptFile}`)
  assert.ok(
    foundTypeScriptFile,
    `should contain .ts filenames. Found ${allFilenames.size} unique filenames:\n${filenameList.join('\n')}`
  )
}

// Helper to decode and validate a profile
function decodeAndValidateProfile (encodedProfile, checkLocations) {
  assert.ok(encodedProfile instanceof Uint8Array, 'should be Uint8Array')
  assert.ok(encodedProfile.length > 0, 'should have content')

  const profile = Profile.decode(encodedProfile)
  assert.ok(profile.function, 'should have functions')
  assert.ok(profile.function.length > 0, 'should have at least one function')

  if (checkLocations) {
    assert.ok(profile.location, 'should have locations')
    assert.ok(profile.location.length > 0, 'should have at least one location')
  }

  return profile
}

// Build TypeScript service once before all tests
test.before(async () => {
  console.error('[CI-LOG] Starting TypeScript build in test.before hook')
  const serviceDir = resolve(import.meta.dirname, 'fixtures/sourcemap-test/service')
  console.error(`[CI-LOG] Service directory: ${serviceDir}`)

  // Build the TypeScript (dependencies are in parent package devDependencies)
  try {
    console.error('[CI-LOG] Running npx tsc...')
    const { stdout, stderr } = await execAsync('npx tsc', { cwd: serviceDir, timeout: 30000 })
    console.error(`[CI-LOG] TypeScript build completed. Stdout: ${stdout}, Stderr: ${stderr}`)
  } catch (err) {
    console.error(`[CI-LOG] TypeScript build FAILED: ${err.message}`)
    throw new Error(`Failed to build TypeScript service: ${err.message}\nStdout: ${err.stdout}\nStderr: ${err.stderr}`)
  }

  // Verify build artifacts exist
  console.error('[CI-LOG] Verifying build artifacts...')
  const { access } = await import('node:fs/promises')
  const pluginPath = resolve(serviceDir, 'dist/plugin.js')
  const mapPath = resolve(serviceDir, 'dist/plugin.js.map')
  console.error(`[CI-LOG] Checking for: ${pluginPath}`)
  console.error(`[CI-LOG] Checking for: ${mapPath}`)
  try {
    await access(pluginPath)
    await access(mapPath)
    console.error('[CI-LOG] Build artifacts verified successfully')
  } catch (err) {
    console.error(`[CI-LOG] Build artifacts NOT FOUND: ${err.message}`)
    throw new Error(`Build artifacts not found: ${err.message}. Plugin: ${pluginPath}, Map: ${mapPath}`)
  }
})

async function createApp (t) {
  console.error('[CI-LOG] createApp: Loading runtime config...')
  const configFile = resolve(import.meta.dirname, 'fixtures/sourcemap-test/platformatic.json')
  console.error(`[CI-LOG] createApp: Config file: ${configFile}`)

  // Ensure tmp directory exists
  const { mkdir } = await import('node:fs/promises')
  const tmpDir = resolve(import.meta.dirname, '../../tmp')
  await mkdir(tmpDir, { recursive: true })

  const logsPath = resolve(tmpDir, `sourcemap-test-${Date.now()}.log`)
  console.error(`[CI-LOG] createApp: Runtime logs will be at: ${logsPath}`)

  console.error('[CI-LOG] createApp: Creating runtime...')
  const app = await createRuntime(configFile, null, { logsPath })
  console.error('[CI-LOG] createApp: Runtime created')

  // Read and dump logs on test failure
  t.after(async () => {
    console.error('[CI-LOG] createApp: Cleanup - closing app...')
    await app.close()
    console.error('[CI-LOG] createApp: Cleanup - app closed')

    // Dump runtime logs for debugging
    try {
      const { readFile } = await import('node:fs/promises')
      const logs = await readFile(logsPath, 'utf-8')
      console.error('[CI-LOG] ===== RUNTIME LOGS START =====')
      console.error(logs)
      console.error('[CI-LOG] ===== RUNTIME LOGS END =====')
    } catch (err) {
      console.error(`[CI-LOG] Could not read runtime logs: ${err.message}`)
    }
  })

  console.error('[CI-LOG] createApp: Starting runtime...')
  const url = await app.start()
  console.error(`[CI-LOG] createApp: Runtime started at ${url}`)

  // Monitor worker exits
  if (app.platformaticManagement?.operationManager?.workers) {
    for (const [name, worker] of Object.entries(app.platformaticManagement.operationManager.workers)) {
      console.error(`[CI-LOG] createApp: Monitoring worker ${name}`)
      worker.on('exit', (code) => {
        console.error(`[CI-LOG] WORKER EXIT: Worker ${name} exited with code ${code}`)
      })
      worker.on('error', (err) => {
        console.error(`[CI-LOG] WORKER ERROR: Worker ${name} error: ${err.message}`)
        console.error(`[CI-LOG] WORKER ERROR stack: ${err.stack}`)
      })
    }
  }

  // Wait for services and handlers to register
  console.error('[CI-LOG] createApp: Waiting for services to register...')
  await new Promise(resolve => setTimeout(resolve, 200))
  console.error('[CI-LOG] createApp: Services registered')

  return { app, url }
}

test('sourcemaps should be initialized and profiling should work with TypeScript', async t => {
  console.error('[CI-LOG] Test started: sourcemaps with TypeScript')
  const { app, url } = await createApp(t)
  console.error(`[CI-LOG] App created, URL: ${url}`)

  // Verify service is running
  console.error('[CI-LOG] Verifying service is running...')
  const res = await request(`${url}/`)
  const json = await res.body.json()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(json.message, 'Hello from TypeScript')
  console.error('[CI-LOG] Service verified running')

  // Verify sourcemap files exist in service directory
  console.error('[CI-LOG] Checking for sourcemap files via diagnostic endpoint...')
  let diag
  try {
    const diagRes = await request(`${url}/diagnostic`, { headersTimeout: 10000, bodyTimeout: 10000 })
    console.error(`[CI-LOG] Diagnostic request completed with status: ${diagRes.statusCode}`)
    diag = await diagRes.body.json()
    console.error(`[CI-LOG] Diagnostic response: ${JSON.stringify(diag)}`)
  } catch (err) {
    console.error(`[CI-LOG] ERROR: Diagnostic request failed: ${err.message}`)
    console.error(`[CI-LOG] ERROR stack: ${err.stack}`)
    throw err
  }
  assert.strictEqual(diag.pluginMapExists, true, `Sourcemap file should exist at ${diag.serviceDir}/plugin.js.map`)
  console.error('[CI-LOG] Sourcemap files verified')

  // Start profiling with sufficient duration to ensure we capture samples
  console.error('[CI-LOG] Starting profiling...')
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 5000 })
  console.error('[CI-LOG] Profiling start command sent')

  // Wait for profiler to actually start
  console.error('[CI-LOG] Waiting for profiler to start...')
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    console.error(`[CI-LOG] Profiler state check: isProfilerRunning=${state.isProfilerRunning}`)
    return state.isProfilerRunning
  }, 2000)
  console.error('[CI-LOG] Profiler started')

  // Make requests spread over time to ensure continuous CPU activity during profiling
  // Use shorter interval and add timeout to prevent hanging
  console.error('[CI-LOG] Starting request interval for CPU activity...')
  let requestCount = 0
  let consecutiveFailures = 0
  let intervalStopped = false
  const requestInterval = setInterval(() => {
    if (intervalStopped) return

    requestCount++
    console.error(`[CI-LOG] Sending compute request #${requestCount}`)
    request(`${url}/compute`, { headersTimeout: 30000, bodyTimeout: 30000 })
      .then(() => {
        console.error(`[CI-LOG] Compute request #${requestCount} completed`)
        consecutiveFailures = 0
      })
      .catch((err) => {
        console.error(`[CI-LOG] Compute request #${requestCount} failed: ${err.message}`)
        consecutiveFailures++

        // If we get 3 consecutive connection failures, the service likely crashed
        if (consecutiveFailures >= 3 && (err.message.includes('ECONNREFUSED') || err.message.includes('ECONNRESET'))) {
          console.error(`[CI-LOG] ERROR: Service appears to have crashed (${consecutiveFailures} consecutive connection failures)`)
          intervalStopped = true
          clearInterval(requestInterval)
          throw new Error(`Service crashed - ${consecutiveFailures} consecutive connection failures: ${err.message}`)
        }
      })
  }, 300)

  // Wait for profile to be captured
  console.error('[CI-LOG] Waiting for profile to be captured...')
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    console.error(`[CI-LOG] Profile check: hasProfile=${state.hasProfile}`)
    return state.hasProfile
  }, 10000)
  console.error('[CI-LOG] Profile captured')

  clearInterval(requestInterval)
  console.error('[CI-LOG] Stopped request interval')

  // Get the profile - this should succeed with SourceMapper initialized
  console.error('[CI-LOG] Getting last profile...')
  const encodedProfile = await app.sendCommandToApplication('service', 'getLastProfile')
  console.error(`[CI-LOG] Got profile, size: ${encodedProfile.length} bytes`)
  const profile = decodeAndValidateProfile(encodedProfile, true)
  console.error(`[CI-LOG] Profile decoded, functions: ${profile.function.length}`)

  // Verify sourcemaps are working by checking for .ts file extensions
  console.error('[CI-LOG] Verifying TypeScript files in profile...')
  verifyTypeScriptFilesInProfile(profile)
  console.error('[CI-LOG] TypeScript files verified in profile')

  console.error('[CI-LOG] Stopping profiling...')
  await app.sendCommandToApplication('service', 'stopProfiling')
  console.error('[CI-LOG] Test completed successfully')
})

// TODO: Re-enable once heap profiling + SourceMapper segfault is resolved
// test('sourcemaps should work with heap profiling', async t => {
//   const { app, url } = await createApp(t)
//
//   // Start heap profiling - this should work with SourceMapper
//   await app.sendCommandToApplication('service', 'startProfiling', { type: 'heap' })
//
//   // Make multiple requests to allocate memory in TypeScript code
//   // This ensures our TypeScript code shows up in the heap profile
//   for (let i = 0; i < 10; i++) {
//     await request(`${url}/compute`, { headersTimeout: 30000, bodyTimeout: 30000 })
//   }
//
//   // Wait for allocations to settle
//   await new Promise(resolve => setTimeout(resolve, 500))
//
//   // Get the heap profile - this should succeed with SourceMapper initialized
//   const encodedProfile = await app.sendCommandToApplication('service', 'getLastProfile', { type: 'heap' })
//   const profile = decodeAndValidateProfile(encodedProfile)
//
//   // Verify sourcemaps work for heap profiling
//   verifyTypeScriptFilesInProfile(profile)
//
//   await app.sendCommandToApplication('service', 'stopProfiling', { type: 'heap' })
// })
