# SourceMapper Windows Investigation

## Problem Statement

CPU profiling with SourceMapper causes the application worker to exit cleanly (code 0) on Windows approximately 143ms after profiling starts. The same code works correctly on Linux and macOS.

## Key Observations

1. **Windows Behavior (FAILS)**:
   - Worker exits with code 0 (clean exit, not a crash)
   - Occurs ~143ms after `startProfiling()` completes
   - SourceMapper.create() succeeds
   - CPU profiler.start() appears to succeed
   - No uncaught exceptions or unhandled rejections logged
   - Error: "The worker 0 of the application "service" exited prematurely with error code 0"

2. **Linux/macOS Behavior (WORKS)**:
   - Worker continues normally
   - Profiling works correctly
   - SourceMaps are applied successfully

3. **Other Tests**:
   - ALL 24 other profiling tests pass on Windows (without SourceMapper)
   - Only the sourcemap test fails
   - This strongly suggests the issue is specifically related to SourceMapper on Windows

## Investigation Steps Taken

### 1. Code Review
- Examined @datadog/pprof SourceMapper implementation
- SourceMapper.create() performs file scanning and source map loading
- No persistent timers, file watchers, or background processes created
- No cleanup/disposal methods needed

### 2. Usage Verification
- Confirmed sourceMapper is only used during profile serialization
- Passed to `time.start()` via options object
- Used by `serializeTimeProfile()` to remap generated locations to source locations

### 3. Known Issues Search
- @datadog/pprof is actively maintained fork of google/pprof-nodejs
- Has prebuilt binaries for Windows x64 + Node 22
- No documented Windows-specific issues with SourceMapper
- Historical Windows compilation issues were fixed in earlier versions
- Worker thread profiling issues exist but are about starting profiler IN workers, not FROM workers

### 4. Comprehensive Logging Added
- Process-level crash handlers (uncaughtException, unhandledRejection, exit)
- SourceMapper initialization logging
- Profiler start/stop logging
- Worker exit/error monitoring
- Runtime log capture and dump

## Hypotheses

### H1: Native Profiler Bug on Windows
The native profiler code may have a Windows-specific issue when using SourceMapper that causes the process to exit cleanly. However, the clean exit (code 0) suggests this is intentional, not a crash.

### H2: File Access/Locking Issue
SourceMapper scans directories and reads .map files. Windows file locking or permissions might cause an issue, but this would likely throw an exception rather than cause a clean exit.

### H3: Worker Thread Interaction
Something about how the native profiler uses SourceMapper in worker threads might be Windows-specific. However, our usage matches the documented API.

### H4: Timing/Race Condition
The 143ms delay suggests the profiler takes a few samples (intervalMicros=33333, so ~4-5 samples) before the exit. Maybe the first source map resolution attempt triggers the issue?

## Test Artifacts Created

### Minimal Reproduction Test
Created `test/minimal-sourcemap.test.js` and `test/fixtures/minimal-sourcemap-worker.js` to test SourceMapper in a plain worker thread without the runtime. This will help isolate whether the issue is:
- General SourceMapper + worker threads on Windows, OR
- Specific to runtime/ITC integration

**Status**: Created but not yet run on Windows (CI was cancelled)

## Next Steps

### Option 1: Complete Minimal Test Run
Run the minimal test on Windows CI to determine if the issue reproduces in a simpler context.

### Option 2: Report Upstream
If minimal test also fails, report issue to @datadog/pprof repository with:
- Minimal reproduction case
- Platform: Windows, Node 22
- Symptoms: Worker exits cleanly when using SourceMapper
- All logging output

### Option 3: Additional Debugging
- Add native code-level logging if possible
- Try different SourceMapper configurations
- Test with older versions of @datadog/pprof
- Test on different Windows versions

### Option 4: Workaround (if user approves)
- Disable SourceMapper on Windows only (user has indicated preference to avoid platform-specific logic)
- Document limitation

## Code Locations

- Main implementation: `packages/wattpm-pprof-capture/index.js`
- Test: `packages/wattpm-pprof-capture/test/sourcemap.test.js`
- Minimal test: `packages/wattpm-pprof-capture/test/minimal-sourcemap.test.js`
- Fixture: `packages/wattpm-pprof-capture/test/fixtures/sourcemap-test/service/plugin.ts`

## CI Logs

Latest run: 18609859289
- Windows jobs were cancelled before completion
- Ubuntu logs show normal behavior with sourcemaps working

## Timeline

- 143ms: Time from profiler start to worker exit on Windows
- 33ms: Profiling interval (intervalMicros=33333)
- 5000ms: Profile rotation interval
- 2000ms: Test timeout for profiler state checks

## Dependencies

- `@datadog/pprof`: ^5.3.0 (actively maintained fork)
- Node.js: 22.19.0+ (as per package.json engines)
- Platforms tested: macOS (local), Linux (CI), Windows (CI)

## Conclusion

This appears to be a Windows-specific issue with @datadog/pprof SourceMapper in worker threads. The clean exit suggests intentional termination rather than a crash, but no exception handling catches it. Further investigation with the minimal test is needed to isolate whether this is a general SourceMapper issue or specific to the runtime integration.
