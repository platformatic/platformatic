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
  const serviceDir = resolve(import.meta.dirname, 'fixtures/sourcemap-test/service')

  // Build the TypeScript (dependencies are in parent package devDependencies)
  try {
    await execAsync('npx tsc', { cwd: serviceDir, timeout: 30000 })
  } catch (err) {
    throw new Error(`Failed to build TypeScript service: ${err.message}\nStdout: ${err.stdout}\nStderr: ${err.stderr}`)
  }

  // Verify build artifacts exist
  const { access } = await import('node:fs/promises')
  const pluginPath = resolve(serviceDir, 'dist/plugin.js')
  const mapPath = resolve(serviceDir, 'dist/plugin.js.map')
  try {
    await access(pluginPath)
    await access(mapPath)
  } catch (err) {
    throw new Error(`Build artifacts not found: ${err.message}. Plugin: ${pluginPath}, Map: ${mapPath}`)
  }
})

async function createApp (t) {
  const configFile = resolve(import.meta.dirname, 'fixtures/sourcemap-test/platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const url = await app.start()
  // Wait for services and handlers to register
  await new Promise(resolve => setTimeout(resolve, 200))

  return { app, url }
}

test('sourcemaps should be initialized and profiling should work with TypeScript', async t => {
  const { app, url } = await createApp(t)

  // Verify service is running
  const res = await request(`${url}/`)
  const json = await res.body.json()
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(json.message, 'Hello from TypeScript')

  // Verify sourcemap files exist in service directory
  const diagRes = await request(`${url}/diagnostic`)
  const diag = await diagRes.body.json()
  assert.strictEqual(diag.pluginMapExists, true, `Sourcemap file should exist at ${diag.serviceDir}/plugin.js.map`)

  // Start profiling with sufficient duration to ensure we capture samples
  await app.sendCommandToApplication('service', 'startProfiling', { durationMillis: 5000 })

  // Wait for profiler to actually start
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.isProfilerRunning
  }, 2000)

  // Make requests spread over time to ensure continuous CPU activity during profiling
  // Use shorter interval and add timeout to prevent hanging
  const requestInterval = setInterval(() => {
    request(`${url}/compute`, { headersTimeout: 30000, bodyTimeout: 30000 }).catch(() => {}) // Fire and forget
  }, 300)

  // Wait for profile to be captured
  await waitForCondition(async () => {
    const state = await app.sendCommandToApplication('service', 'getProfilingState')
    return state.hasProfile
  }, 10000)

  clearInterval(requestInterval)

  // Get the profile - this should succeed with SourceMapper initialized
  const encodedProfile = await app.sendCommandToApplication('service', 'getLastProfile')
  const profile = decodeAndValidateProfile(encodedProfile, true)

  // Verify sourcemaps are working by checking for .ts file extensions
  verifyTypeScriptFilesInProfile(profile)

  await app.sendCommandToApplication('service', 'stopProfiling')
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
