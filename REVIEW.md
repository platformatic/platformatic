# Adversarial review of `NEW_CONFIG.md` — round 26

## Verdict

Six new concrete gaps remain. The round-25 serving fix handles object-form Vite SSR but misses the supported boolean shorthand before the worker-side transform; several normative sections still apply the old “all frameworks under dev” error to the worker-classified Vite SSR row. The new serving state also lacks a named public DTO field and an aggregation invariant across workers. Separately, zero-config `--save` still does not define how its generated multi-app file preserves the synthesized, environment-sensitive port, and its atomic rename has no no-clobber rule.

## Blockers

### 1. `vite.ssr: true` bypasses the new config-dependent serving classification

The new schema-subpath example selects worker classification only when `config.vite?.ssr?.enabled` is truthy (`NEW_CONFIG.md:1481-1516`). That handles object form but not the boolean shorthand the shipped schema accepts (`packages/vite/lib/schema.js:25-43`). Validation leaves the authored boolean as `true`; only Vite's capability `transform()` rewrites it to `{ enabled: true, entrypoint: … }` (`packages/vite/index.js:8-19`). The proposal deliberately evaluates `servesWithoutPort` main-side after capability validation and before the worker exists, while the capability transform remains worker-side, so the callable sees `true`, not the normalized object.

The loader therefore classifies `vite({ ssr: true })` as ordinary Vite—inactive under `dev`, mesh-only under `start`—but `create()` later selects `ViteSSRCapability` after the transform (`packages/vite/index.js:45-65`). That class inherits Node's runtime-dependent serving decision. Under development the wrong static answer rejects a valid in-process SSR factory; under production it can promise mesh availability for an SSR module that reports no server.

**Required correction:** recognize both `config.vite?.ssr === true` and `config.vite?.ssr?.enabled === true`, or pass a schema-normalized discriminator that is guaranteed identical to class selection. Add the boolean shorthand to every Vite SSR serving-state test; object-form coverage does not exercise this path.

### 2. A singular serving state is undefined when workers of one application disagree

`getServingState()` is computed by each started worker, but the proposal exposes one application-level line and one value from `getApplicationDetails()` (`NEW_CONFIG.md:1643-1690`). Node's answer depends on the module and the result of invoking the application's factory in that worker (`packages/node/lib/capability.js:137-250`). Nothing requires arbitrary application code to return the same `isBackgroundApplication`/server shape in every worker.

Current application-level ITC reads do not aggregate: `getApplicationDetails()` asks one selected worker for status/info (`packages/runtime/lib/runtime.js:2140-2173`), and an unindexed application id is resolved through the normal next-worker selector (`:3811-3827`). With two workers, a factory can return Fastify from worker 0 and a background result from worker 1. Depending on which worker answers, details/reporting says mesh-only or background; mesh dispatch can still select the non-serving worker. Scaling can introduce the disagreement after the initial report as well.

**Required correction:** collect serving state for every worker and define an invariant. The smallest safe contract is to reject mixed serving categories for one application at start and scale-up, naming the workers/states; alternatively expose a per-worker map and exclude inactive/background workers from HTTP dispatch. A single value sampled from one worker is not sufficient. Add a factory that branches on worker index as the negative test.

### 3. Materializing Level 0 does not specify how the synthesized port survives the transition to multi-app

Level 0 injects `server.port = Number(env.PORT || 3042)` because a detected framework app otherwise starts nothing (`NEW_CONFIG.md:1525-1545`). Adding a sibling then writes a stamped plain-object **multi-app** root containing the detected application as an explicit entry (`NEW_CONFIG.md:3086-3121`). Elsewhere the design says multi-app projects do not rely on detector-only entries and that a global `PORT` expression must become a per-application `PLT_<ID>_PORT` expression when siblings appear (`NEW_CONFIG.md:20-59`, `:2052-2079`).

The generated payload is not defined tightly enough to satisfy all three contracts:

- emitting only `{ id, path }` re-runs the detector but loses Level 0's synthesized server block, so a detected Next/Vite app becomes inactive or fails load under `dev`;
- serializing the resolved synthetic object freezes the current numeric `PORT` value into the stamped JSON-like output, so future deployment changes to `PORT` no longer work;
- emitting the original global `PORT` expression keeps the old single-app variable after the file has become multi-app, contradicting the required per-app scoping and risking sibling collisions.

**Required correction:** specify the exact emitted existing-app definition. It must include the detected `module` and an authored expression such as `Number(process.env.PLT_<ID>_PORT || 3042)` (with the canonical normalized id), rather than omitting configuration or serializing the current resolved number. Mark this generated source as expression-bearing plain-object code, not `JSON.stringify(resolvedConfig)`, and test a changed environment value after materialization/reboot.

## High-priority correctness issues

### 4. The old “all frameworks under dev” rule still contradicts the Vite SSR worker-classified row

The new matrix correctly makes Vite SSR worker-classified in both modes (`NEW_CONFIG.md:1462-1516`). Four later/earlier normative statements still say otherwise: the summary says a framework without a port does not start under `dev` (`NEW_CONFIG.md:46-55`), the development bullet cites all Vite as inactive (`:1436-1439`), the load-error rule says every framework under `dev` is refused (`:1611-1617`), and breaking change 19 repeats that implementation rule (`:4596-4605`). The report section also still concludes that it “needs no third shape” immediately after defining four shapes (`:1643-1707`).

An implementation following the matrix starts Vite SSR and asks its worker; one following the load-error/checklist text rejects it before startup. These are conflicting executable contracts, not merely old rationale.

**Required correction:** qualify every generic framework statement with the static rows from the matrix and explicitly exempt worker-classified Vite SSR. Replace the stale shape-count conclusion with the narrower fact it intends: a custom command that times out never reaches any report row.

### 5. `getApplicationDetails()` has no named field for serving state and cannot reuse its existing `status`

The proposal says the worker's `getServingState()` value “travels with the status reply” and “the same value appears in `getApplicationDetails()`” (`NEW_CONFIG.md:1657-1670`), but it never names the property or updates the runtime implementation-plan item. Today `ApplicationDetails.status` already means worker lifecycle status, while URL emission tests `status === 'started'` (`packages/runtime/lib/runtime.js:2140-2173`); the public type exposes that field separately from `url`/`urls` (`packages/runtime/index.d.ts:114-127`).

If the new enum replaces `status`, existing lifecycle consumers break and the current URL gate drops URLs because `'listening' !== 'started'`. If it is an additional field, its name/type and management payload remain unspecified. “Status reply” is also ambiguous between the current `getStatus` and `getApplicationInfo` ITC calls.

**Required correction:** add a separate, typed `servingState: 'listening' | 'mesh-only' | 'background' | 'inactive'` field to worker info and `ApplicationDetails`, preserving lifecycle `status`. Update the runtime/management API implementation plan and define behavior for stopped/unloaded applications (absent or null), then test both fields together.

### 6. Atomic publish can overwrite a concurrently created configuration or create a two-candidate directory

The zero-config branch validates while no config path exists, performs the live mutation, then publishes with write-and-rename (`NEW_CONFIG.md:3095-3112`). It does not recheck the complete recognized candidate set (`watt.config.ts`, `.mts`, `.js`, `.mjs`; `NEW_CONFIG.md:853-859`) or require a no-replace commit. Another editor/process can create a candidate during the potentially long live startup.

The filesystem branches differ but are all material: on POSIX, `rename` over the same target replaces it atomically, losing the concurrently authored file; on platforms/filesystems that refuse replacement, publication fails after the live mutation and takes the documented partial-outcome path; if the concurrent file uses a sibling suffix, the rename can succeed and leave two candidates, so the watcher reload fails with the ambiguity error. Atomicity alone does not provide exclusivity.

**Required correction:** immediately before commit, canonicalize and recheck all sibling candidates, and publish with a no-clobber primitive/lock rather than ordinary replacement rename. If any candidate appeared, preserve it, report the already-live partial outcome, and print the rendered config for manual merging. Add same-target and sibling-suffix race tests.
