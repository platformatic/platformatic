# Adversarial review of `NEW_CONFIG.md` — round 25

## Verdict

Five new concrete gaps remain after the round-24 fixes. The new serving matrix is still too coarse: `@platformatic/vite` chooses between two capability classes with different, partly runtime-dependent no-port behavior, and the advertised third-party `'worker'` fallback has no generic protocol capable of returning the promised state. The new zero-config `--save` branch also writes in the wrong order for a watched runtime and hard-codes a suffix that is invalid in CommonJS packages. Finally, the strengthened citation gate still fails open when its lockfile or a historical commit is unavailable.

## Blockers

### 1. Package-level `servesWithoutPort` cannot classify Vite's config-selected SSR capability

The proposal gives `@platformatic/vite` one package-level declaration—development `false`, production `true`—and the exhaustive matrix therefore labels every Vite app inactive under `dev` and mesh-only under `start` when no port/command exists (`NEW_CONFIG.md:1429-1497`). That describes `ViteCapability`, but the package does not always instantiate that class.

`@platformatic/vite` selects `ViteSSRCapability` whenever the validated `vite.ssr.enabled` option is true (`packages/vite/index.js:45-65`). `ViteSSRCapability` extends `NodeCapability`, overrides only entrypoint/build/meta behavior, and delegates startup to the complete Node startup path before calling Node's listener (`packages/vite/lib/capability.js:334-388`). That path imports the application, invokes its `build`/`create` factory when present, initializes Fastify/Koa/raw-server dispatch, and only then lets `_listen()` return on an omitted port (`packages/node/lib/capability.js:137-250`, `:457-485`). Its server/background decision therefore depends on `module.hasServer` and the factory result's `isBackgroundApplication`, exactly like the matrix's worker-classified Node row.

Following the static Vite declaration rejects a valid no-port Vite SSR factory under `dev` before it can initialize an in-process dispatcher. Under `start`, it claims static mesh availability even when the SSR module reports `hasServer = false` or returns a background application. This is not fixed by reading both Vite methods in isolation; class selection and inherited Node startup are the deciding path.

**Required correction:** make serving metadata capable of returning a result from the resolved capability configuration, or conservatively mark the whole Vite package `'worker'`. At minimum, `vite.ssr.enabled` must select worker classification while ordinary Vite keeps the current per-mode constants. Add no-port Vite SSR tests in both modes with a Fastify factory and with `hasServer = false`/`isBackgroundApplication`.

### 2. The absent-metadata `'worker'` fallback has no generic state-reporting contract

The proposal says a third-party schema subpath that omits `servesWithoutPort` defaults to `'worker'`, avoiding both a false rejection and a false mesh URL (`NEW_CONFIG.md:1491-1497`, `:1551-1559`). But the worker-report contract described later is Node-specific: only Node's private `#hasServer()` result supplies the `background` state (`NEW_CONFIG.md:1601-1645`). The capability implementation plan adds the metadata constant but no generic post-start serving-state method (`:4758-4767`).

Current generic capability APIs cannot fill that gap. `BaseCapability.getInfo()` returns only type/version/dependencies, and `getDispatchTarget()` falls back to the capability object whenever there is no URL (`packages/basic/lib/capability.js:408-418`). That fallback exists even when a third-party start method returned without constructing anything; its presence is not evidence that `inject()` can answer. The report deliberately has no `inactive` post-start state (`NEW_CONFIG.md:1647-1653`), so an omitted declaration cannot be mapped truthfully to any documented row without a new capability signal.

**Required correction:** either require every v4 third-party schema subpath to declare `servesWithoutPort`, rejecting an absent field with an upgrade error, or add a v4 capability method/status field that explicitly returns `listening | mesh-only | background | inactive` after startup. Use that method for Node and config-dependent Vite SSR too; do not infer readiness from a URL's absence or `BaseCapability.getDispatchTarget()`.

### 3. Zero-config `--save` writes the watched file before the live mutation, creating a reload race and no rollback branch

The new branch says a synthesized runtime writes the complete root config **and then** applies the live add/remove (`NEW_CONFIG.md:3040-3056`). Under `wattpm dev`, the watcher explicitly watches absent config candidates for creation and recomputes/reloads topology when one appears (`NEW_CONFIG.md:2160-2206`). Creating the first `watt.config.*` is therefore itself a runtime mutation.

The outcome depends on timing, and each branch needs a contract. If the watcher reloads first, the new file may already add/remove the application before the command sends POST/DELETE, producing a duplicate/not-found response or a management-socket interruption. If the live request wins, the subsequent reload may converge correctly. Outside watch mode, or if the live request fails validation/startup, the file remains changed while the running runtime does not. The text's claim that checking `configPath` first prevents a false atomic success addresses only an unwritable target; it does not coordinate these two independently failing mutations.

**Required correction:** define a transaction/order that accounts for the watcher. One workable shape is: render and validate staged content, perform the live mutation, atomically publish the file so the ensuing reload converges to the same topology, and compensate/report explicitly if publication fails. Alternatively suppress/await the specific reload while the command commits both sides. Tests must force both watcher orderings and live-start/save failures rather than relying on timing.

## High-priority correctness issues

### 4. The materialized zero-config filename is invalid in a CommonJS package, and its emitted module form is unspecified

The new branch unconditionally writes `watt.config.ts` (`NEW_CONFIG.md:3049-3056`). Elsewhere the proposal requires `watt.config.mts` when the target package has `"type": "commonjs"` (`NEW_CONFIG.md:2358-2361`) and explicitly says an ESM `export default` in a CommonJS `.js`/`.ts` context is invalid (`:2909-2913`). On the repository's Node 24 runtime, a `.ts` file containing `export default` beneath `{ "type": "commonjs" }` exits with `SyntaxError: Unexpected token 'export'`.

The branch also does not say whether it emits an imported `defineConfig`, which requires a root-resolvable `wattpm`, or the dependency-free machine object, which requires the literal `$schema` marker (`NEW_CONFIG.md:2786-2845`). A valid zero-config project need not already have the dependency chosen by the first branch, while omitting the marker from the second defeats the machine-format version contract.

**Required correction:** reuse one canonical config-writer suffix/form selector. For a no-install `--save`, the smallest self-contained output is a stamped plain-object export, using `.mts` in CommonJS packages and `.ts` otherwise; if the design instead imports `wattpm`, it must first guarantee/install that root dependency. Add CommonJS and ESM zero-config materialization-and-reboot tests.

## Tooling gate

### 5. Citation verification still passes with no lockfile and with unverifiable historical commits

The new test proves an unblessed citation fails only when the scratch lock is already non-empty; it explicitly treats an empty lock as bootstrap (`scripts/test/check-citations.test.mjs:35-48`). In verify mode, the checker records `problems.unblessed` only when `Object.keys(lock.citations).length` is nonzero (`scripts/check-citations.mjs:234-243`). With `CITATIONS_LOCK` pointing to a missing file, a document containing a real citation prints `OK`, exits 0, and leaves the lockfile missing. Deleting or emptying `scripts/citations.lock.json` therefore bypasses the workflow that is supposed to enforce it.

A second fail-open path remains: an unreachable historical revision is added to `problems.unavailable` (`scripts/check-citations.mjs:216-226`) and reported, but `unavailable` is absent from the failure count (`:357-380`). A typo such as `pre-\`deadbeef\`` prints “not verifiable here” and still exits 0. `fetch-depth: 0` reduces shallow-clone failures but cannot turn a typo, rewritten commit, or deleted lock into verified evidence.

**Required correction:** in verify mode, treat every citation as unblessed when the lock is missing/empty, and include `problems.unavailable` in the failure count. Bootstrap must be the explicit `--update` operation, never implicit verification. Add negative tests for a missing lock, an empty lock, and an unreachable historical SHA.
