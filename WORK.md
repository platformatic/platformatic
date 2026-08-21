# Work Handoff

## Objective

Complete the Watt/Runtime migration to Undici 8 and `undici-thread-interceptor` (UTI) v2, including WebSocket routing, compatibility fixes, and zero-loss worker replacement.

## Repository State

- Platformatic worktree: `platformatic-v4`
- Base version: `3.67.0`
- Runtime dependency currently declares `undici-thread-interceptor: ^2.0.3`.
- The installed `node_modules/undici-thread-interceptor` is a local build from the UTI `mesh-ack` branch, not the published 2.0.3 package.
- `node_modules` is not tracked and is not part of this commit.

## External UTI Work

UTI repository: `platformatic/undici-thread-interceptor`

Branch: `mesh-ack`

Latest validated commit:

```text
e32f601 fix: preserve worker ids when retiring peers
```

The branch adds mesh propagation acknowledgements:

- Mesh mutations carry an `operationId`.
- Interceptors reply with `MESH_ACK` after applying routing state.
- The coordinator replies with `MESH_APPLIED` after all relevant interceptors acknowledge.
- Server readiness waits for its join operation to be applied.
- Server close remains operational until its leave operation is applied, then drains requests and peers.
- Dispatch revalidates stale TCP and thread targets before posting requests.

The additional `e32f601` fix is required because Platformatic worker IDs contain colons, for example `application-1:0`. The prototype previously parsed a peer key at the first colon, incorrectly retired the peer on every mesh update, and leaked a referenced `MessagePort`. Peers now store and use `serverId` directly. The UTI test suite passes 148/148 with this fix.

## Recreate Local UTI Installation

Until a new UTI version containing `mesh-ack` is published:

```bash
git clone git@github.com:platformatic/undici-thread-interceptor.git
cd undici-thread-interceptor
git switch mesh-ack
npm install
npm run build
cp -R dist/. /path/to/platformatic-v4/node_modules/undici-thread-interceptor/dist/
cp package.json /path/to/platformatic-v4/node_modules/undici-thread-interceptor/package.json
```

Do not run `pnpm install` in Platformatic afterward without recopying the prototype, because installation restores the published 2.0.3 package.

## Platformatic Changes

### Runtime Mesh

- Migrated to UTI v2 coordinator/interceptor/server roles.
- Added `createUpgradeAgent()` WebSocket routing.
- Added explicit per-worker UTI servers and cleanup.
- Removed obsolete v1 ready-promise plumbing.
- Preserved legacy global dispatcher compatibility.
- Runtime now awaits `dispatcher.server.ready` for both thread and TCP targets. With `mesh-ack`, this means a replacement is visible to all relevant interceptors before Runtime retires the old worker.
- `removeFromMesh()` awaits graceful server removal before stopping the application.

### Dispatch Semantics

- Ordinary Node/Koa applications retain capability injection semantics.
- Upgrade-capable Node servers expose the composite `inject`, `emit`, `listenerCount`, and `server` target.
- Do not change ordinary Node/Koa targets to URL/TCP dispatch.

### WebSockets and Gateway

- Added mesh WebSocket routing and tests.
- Updated gateway watcher and GraphQL composition behavior for the migration.
- Do not mask worker replacement failures with gateway retries.

### Vite HTTP/2 Compatibility

- Added a Platformatic-only Vite middleware that maps `:authority` to `host` and removes HTTP/2 pseudo-headers from a copied header object.
- Preserves the original request method and URL.
- Leaves HTTP/1 requests unchanged.
- Added focused tests in `packages/vite/test/http2-headers-plugin.test.js`.
- The chosen scope is Vite only. Do not add a Remix workaround or a separate UTI pseudo-header change.

### Package and Fixture Compatibility

- Updated workspace Undici dependencies to `^8.5.0`.
- Updated UTI dependency and release-age exclusion to 2.0.3.
- Updated Wattpm dependency-version expectations.
- Mocked global `fetch` in the NPM registry failure fixture.
- Disabled npm minimum release age for the Next pack test.
- Allowed the Next compatibility fixture to build `sharp`.

## Validation Completed

With the local UTI `mesh-ack` build including `e32f601`:

- UTI suite: 148/148 passed.
- Runtime focused health replacement: passed repeatedly with `errors === 0` and `non2xx === 0`.
- Runtime `test/health-1.test.js`: 7/7 passed.
- Runtime dynamic applications: 6/6 passed.
- Runtime interceptor tests: 6/6 passed.
- Runtime lint for `lib/worker/itc.js`: passed.
- `git diff --check`: passed.

Earlier migration validation also passed:

- Node injection tests: 3/3.
- Full Node suite: 145/145.
- Vite focused tests and lint.
- Wattpm-utils focused and full tests.
- Next pack test.
- Node and Runtime lint.

## Incomplete Validation

- `npm run test:main` in `packages/runtime` exceeded the required 20-minute command timeout.
- That run initially exposed two dynamic-application failures caused by the UTI colon-delimited peer-key bug. After `e32f601`, the focused dynamic suite passes, but the full Runtime main suite has not been rerun end-to-end.
- Next compatibility tests for Next 16.0.0 and 16.1.6 previously returned HTTP 500. Older versions passed. This remains unresolved.
- A full Next compatibility run previously exceeded its focused timeout.

## Next Steps

1. Review and merge the UTI `mesh-ack` branch, including `e32f601`.
2. Publish a new UTI patch version.
3. Update `packages/runtime/package.json` and `pnpm-workspace.yaml` to the published version, regenerate `pnpm-lock.yaml`, and perform a clean install.
4. Verify that no local `node_modules` copy is needed.
5. Rerun the focused health replacement test repeatedly.
6. Run Runtime package suites sequentially, each with a 20-minute timeout.
7. Investigate any remaining Next 16 compatibility failures separately.

Focused worker replacement command:

```bash
cd packages/runtime
for run in 1 2 3 4 5; do
  node --test \
    --test-reporter=cleaner-spec-reporter \
    --test-concurrency=1 \
    --test-timeout=2000000 \
    --test-name-pattern='should not lose any connection' \
    test/health-1.test.js || exit 1
done
```
