# Work Handoff

## Objective

Complete the Watt/Runtime migration to Undici 8 and `undici-thread-interceptor` (UTI) v2, including zero-loss worker replacement and Next.js 16 compatibility.

## Repository State

- Platformatic worktree: `platformatic-v4`
- Base version: `3.67.0`
- Runtime declares `undici-thread-interceptor: ^2.1.1`.
- The dependency and lockfile resolve the published UTI 2.1.1 package.

## UTI Changes

UTI 2.1.1 includes the following changes:

1. Cross-thread `Server.close()` and `Interceptor.close()` only bypass mesh convergence when the coordinator is in the same thread. The previous listener-count-only check caused worker servers to close before interceptors applied the removal mesh.
2. TCP dispatches are counted per server. Removal or address changes delay `MESH_ACK` until active requests finish and Undici completes its request-queue/socket bookkeeping.
3. Thread responses populate `controller.rawHeaders` before `onResponseStart()`, preserving response headers with Undici 8 Fetch.
4. Requests for unknown origins inside the configured mesh domain throw `UND_TI_NO_AVAILABLE_TARGET` instead of falling through to DNS.

The zero-loss failure was caused by both sides of the convergence race: server close returned immediately in worker threads, and interceptor acknowledgement did not wait for active TCP dispatches.

## Platformatic Changes

### Runtime

- Runtime records each worker's `serverOptions` event through `kWorkerServerOptions`.
- Workers configured with TCP port `0` start their replacement before retiring the old worker, even where `reusePort` is unavailable.
- Runtime depends on published UTI 2.1.1.

### Runtime Tests

- The unknown `.plt.local` target assertion expects UTI v2's `NoAvailableTargetError` message and uses a valid string assertion message.
- The management API occupied-socket test uses `os.tmpdir()` and a UUID to stay below the macOS Unix-socket path limit.
- The worker injection round-robin expectation wraps worker `4` back to worker `0`.
- The Basic child-process fetch test expects unknown mesh targets to fail without a DNS lookup.
- The Inquirer PTY regression tests remain enabled on Linux and skip platforms where the required PTY behavior is unavailable.
- The Wattpm mock registry advertises the current 3.67.0 release in both its latest tag and available versions.

### Next.js

- Compatibility fixtures install version-matched local Next.js, React, React DOM, and `@next/swc` packages while retaining Turbopack.
- Production child-manager registration and VM fetch dispatcher compatibility are fixed in the Next capability.
- The complete Next compatibility suite previously passed 76/76.

## Validation

Validation covers the published UTI 2.1.1 package. The local native `better-sqlite3`
module was rebuilt for Node 24 before rerunning the affected Runtime tests.

- Focused zero-loss replacement: five consecutive passes with `errors === 0` and `non2xx === 0`.
- Runtime types: 49/49 tests and 147/147 assertions passed.
- Runtime main: 435 passed, 1 skipped.
- Runtime API: 98/98 passed.
- Runtime CLI: 30 passed, 1 skipped.
- Runtime start: 23/23 passed.
- Runtime multiple workers: 64/64 passed.
- All 37 workspace package test scripts passed after the fixture corrections.
- Next types, main, caching, compatibility, and integration suites passed; the aggregate package command took about 21 minutes because compatibility alone took about 16 minutes.
- All 37 workspace package lint tasks passed.
- Runtime lint: passed.
- UTI patched-file syntax checks: passed.
- `git diff --check`: passed.

## Remaining

- Commit and push the completed changes.
