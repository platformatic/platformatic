# Adversarial review of NEW_CONFIG.md — round 13

**Reviewed:** 2026-08-17, against `041c6441c` (round 12 folded in, 3166 lines).
**Method:** four independent passes — scoping/loading, environment, migration,
contract/coherence — targeting the text round 12 rewrote. Deduplicated; convergent
findings marked.

**Verified personally** before recording: v3 seeding every worker from the runtime
root's env; v3's gateway autodetection testing the raw type and skipping entries with
no `.config`; the two separate `server`/`fastifyServer` schemas; `service`'s
telemetry replacement; nitro's four-key server; `healthChecksTimeouts` living under
`metrics` and being live; no capability schema declaring `reuseTcpPorts`; 15 `ts`
blocks of which only 8 have an `export default`; `#showUrls` logging per worker; and
the abbreviated-citation class.

**Already fixed while reviewing** (committed): the abbreviated citations R7 missed
(`81525ad1b`), and three R9 edits that silently no-opped plus a one-way/two-ways
contradiction (`8d8c432f1`).

**Theme.** Round 12's decisions hold, but three of them were under-specified in ways
that only show up at the edges: the env root is undefined where no config file
exists, the ancestor check acquired veto power it was documented as not having, and
the "every `ts` block is a fixture" promise cannot be kept. Nine findings below are
defects in round-12 fixes.

---

## Blockers

### B1. ~~The env root is undefined wherever no `watt.config.*` exists~~ — **RESOLVED (S1)**

A chain floors at its own directory when nothing is above it; for object sources the
`root` argument stands in. Level 0, `create(root, configObject)` and hot-add all
terminate.

*(original finding)*
*Environment pass.* Rule at `:1553-1558`; instances at `:1035-1037`, `:1361-1367`.

The rule terminates the walk at "the outermost `watt.config.*` above it". Three
sanctioned paths have no config file at all: **Level 0** fires precisely in the
branch "no `watt.config.*` in any ancestor"; **`create(root, configObject)`** defines
only where the walk starts; **hot-add** names an absolute path. v3 was total here —
it walked to the filesystem root with a `process.cwd()` fallback
(`foundation/lib/configuration.js:362-380`), and v4 deletes the fallback.

**Fix:** state the terminator for the no-config case — the config file's own
directory, or the `root` argument for object sources — in all three places.

### B2. ~~An application outside the runtime's directory loses the runtime's env~~ — **RESOLVED (S1)**

An application's environment is its own chain layered over **the deciding file's**
chain. Inside the tree the two coincide; outside it this reconstructs v3, which
seeded every worker from one `loadEnv` at the runtime root regardless of path.
Verified on a fixture: `path: '../shared/worker'` gets `WORKER=yes` over
`DATABASE_URL=from-proj`, matching v3 exactly.

*(original finding)*
*Environment pass; verified.* `:1071-1074`, `:1608-1611`.

v3 seeds **every** worker from the runtime root's `loadEnv` regardless of the app's
location: `#env = config[kMetadata].env` (`runtime.js:242`) → `structuredClone`
(`:2534`) → `env: workerEnv` (`:2585`). Round 12 made the chain a pure function of
the *application* directory, so for `path: '../shared/api'` the runtime's directory is
not an ancestor and its `.env` never applies — to the eval worker or the runtime
worker. **39 in-tree configurations** use parent-relative paths, and `:1060-1063`
calls the layout ordinary.

**Fix:** an application's environment is its own directory's chain layered over **the
deciding file's** chain. Inside the tree the two coincide and collapse to today's
rule; outside it, this reconstructs v3 exactly — and it also gives B1 its terminator,
since the deciding file always exists.

### B3. The ancestor check acquired veto power it is documented as not having, and it breaks Level 0
*Scoping pass.* `:745-752` vs `:1031-1045`.

`:747-748` says the check "**cannot change what boots** — only whether a warning
prints". R4 then made it the gate that *refuses* a boot. The walk is unbounded and
requires nothing of the ancestor, so: a developer with `~/watt.config.ts` runs
`create-next-app ~/projects/foo && wattpm dev` → the config search correctly finds
nothing, the ancestor walk reaches `~`, and **Level 0 is refused**, pointing the user
at `~`. v3 booted.

**Fix:** refuse only when the ancestor genuinely describes this directory — require
it to lie within the same package/workspace as cwd — and correct `:747-748`, which is
false either way.

### B4. ~~`portAssignment` is specified for a `server` block service/db/gateway do not use~~ — **RESOLVED (S3)**

Plan step 2 now names **both** declarations, `server` (`:391`) and `fastifyServer`
(`:501`), and states why: they are separate object literals that overlap, so a key
added to one does not reach the other. Issue #5074's scope corrected to match.

*(original finding)*
*Coherence pass; verified.* Plan `:2815-2820`, migrate rule 1 `:2282-2285`.

`foundation/lib/schema.js` exports **two** server schemas: `server` (`:391`, the basic
family) and `fastifyServer` (`:501`, service/db/gateway), which cherry-picks four keys
and is `additionalProperties: false`. Verified: `service`'s server has 28 keys and
**does not** admit `portAssignment`. The plan says "add `portAssignment` to the shared
`server` block" — singular — which never reaches service/db/gateway. Two consequences:
a gateway/service/db application still has **no** way to run `workers > 1` on a fixed
port on macOS/Windows, the hole #5074 exists to close; and migrate rule 1's verbatim
move into a *gateway* entrypoint — the commonest v3 shape — fails step 3.

**Fix:** plan step 2 and #5074 must name **both** `server` and `fastifyServer`.

### B5. Step 3's seed table cannot survive `--resume`
*Migration pass.* `:2478-2496` vs `:2528-2537`.

The seeds are built from the placeholder positions recorded during the **lexical
pass**, which `:2534` says `--resume` skips; the manifest persists paths, pre-edit
contents and the deletion set — not the seed table. So the documented non-interactive
flow (`--no-install` then `--resume`) validates with no seeds, `''` fails the audited
enum, and the failure prints "run `migrate --resume`" — which fails identically
forever.

**Fix:** persist the placeholder/target-type record in the manifest, or state that
`--resume` re-runs the lexical pass (safe — step 5 has deleted nothing).

### B6. Normalizing composer→gateway before entrypoint classification changes which application v3 resolved
*Migration pass; verified.* `:2242-2247`, `:2450-2452`.

v3 tests the **raw** type: `if (application.type === '@platformatic/gateway')`
(`config.js:452` pre-`e2da15eda`), so a `@platformatic/composer` app was never a
gateway candidate. Migrate classifies over the rename-normalized list. Both directions
break: one composer among three apps → v3 had no entrypoint (mesh-only), migrate
resolves one and **opens a public listener**; one composer plus one gateway → v3 had
exactly one, migrate sees two and **drops the root `server` block**.

**Fix:** classify on the pre-rename identity; apply the rename table only to the
closure gate.

### B7. v3's gateway autodetection skips entries with no `applications[].config`; migrate's does not
*Migration pass; verified.* `config.js:447-450` pre-`e2da15eda`:
`if (!application.config) { continue }`. `.config` is populated only for
autoload-discovered entries or an explicit `config` filename. So
`[{ id: 'gw', path: './gw' }, …]` where `./gw` is a gateway: v3 skipped it → no
entrypoint → mesh-only; migrate resolves `gw` and hands it the root `server` block.

**Fix:** replicate the guard, or pre-flight-refuse when it changes the answer.

### B8. "Every `ts` block ships as a golden fixture" is unsatisfiable for 7 of 15
*Coherence pass; verified.* `:2885-2891`.

15 `ts` blocks; **8** have an `export default`. The rest are interface declarations
and fragments — bodiless overload signatures are a `SyntaxError` after type
stripping, and a bare `applications: [ … ]` parses as a labelled statement. Appendix A
then contradicts the commitment at `:2916-2918` by describing a *different* check for
a block step 8 says goes through the loader. I widened this promise in round 12 and
over-corrected.

**Fix:** two gates, with the membership named — loadable configs through the loader,
declaration blocks through `tsc --noEmit` against the shipped `.d.ts`, and Appendix
A's first block additionally key-diffed against `runtime/schema.json`.

---

## Majors

**M1. Level 2b teaches a pattern the runtime silently discards.** *(verified)*
`service/lib/capability.js:214-216` does `config.telemetry = telemetryConfig` — a
wholesale **replacement**. The example sets `telemetry.instrumentations` on the entry
*and* `telemetry.applicationName`/`exporter` in the factory; the latter are dead. This
is the pair round 11 chose to illustrate the entry/factory split, and it validates
while misleading. **Fix:** drop the entry-level `telemetry`, or state the replacement.

**M2. `healthChecksTimeouts` is not top-level and is not dead.** *(verified)* It is
`metrics.healthChecksTimeouts`, live at `runtime.js:4590`, `metrics` is
`additionalProperties: false`. The audit lists it as a removed top-level key, so the
audit would reject working configs and make the timeout unconfigurable.

**M3. Appendix A claims a `reuseTcpPorts` input no schema admits.** *(verified)* No
capability schema declares it; only the entry (`foundation/lib/schema.js:894`) and the
root (`:1100`) do. The documented "three inputs" has an unreachable third.

**M4. ~~nitro's `server` has four keys~~ RESOLVED (S3)** — rule 1 now moves every key *the target capability's schema admits*, dropping the rest with a note, instead of being defined as a fixed list. That covers nitro's missing `http2` and any future narrowing. *(original)*
*(verified)* `nitro/lib/schema.js:29-30` deletes `http2`. A v3 root
`server: { http2: true }` with a nitro entrypoint fails step 3.

**M5. Migrate must pin an `id` the emitted form has nowhere to put.** *(scoping)*
Level 1 is a bare factory export and factories reject orchestration properties, yet
migrate is required to pin `id` — and for a nameless package v3 gave `'main'` while v4
gives the directory name. **Fix:** select Level 1b on id divergence, not only on the
presence of runtime settings.

**M6. An entry in the deciding file's own directory with no inline `config` is
unloadable.** *(scoping)* The deciding-file exemption is stated only inside the
parenthetical about entries *with* an inline `config`, so
`defineConfig({ application: { workers: 2 } })` on a bare repo discovers its own
config file and errors "root config nested in an application entry". **Fix:** state
the exemption over discovery itself.

**M7. `#showUrls` logs per worker, not per application.** *(verified)* Round 11's m7
fix asserted per-application logging as *existing* behaviour; `runtime.js:2408-2428`
iterates applications then workers. The proposed change is stated correctly 60 lines
later. **Fix:** delete the clause and let the later passage own it.

**M8. Autoload ids can now collide, and the merge silently absorbs the loser.**
*(scoping)* Directory names are unique by construction; `package.json` names are not.
Two directories with the same name merge via `config.js:388-393`, and the second's
`path` is discarded — it never boots, unreported. **Fix:** make a collision a boot
error naming both directories.

**M9. `autoload.mappings` pinning ignores an id v3 already pinned, and compares the
un-stripped name.** *(migration)* v3's id is `mappings[dir].id ?? dir`; the rule keys
only on package-name-vs-directory, so an existing mapping id is overwritten — the
exact rename the rule exists to prevent — and a scoped `@acme/frontend` in
`web/frontend` is pinned redundantly.

**M10. Step 3 seeds sentinels unconditionally, masking the project's own `.env`.**
*(migration)* The real environment wins in v4, so seeding overrides values the project
actually configures, inverting "step 3 validates through the real loader". Also
unspecified: one variable in two positions with different target types admits no
single sentinel. **Fix:** seed only unset variables; refuse on incompatible types.

**M11. `resolvedApplicationsBasePath` is excluded from five things but not step 3.**
*(migration)* The loader backfills into that subtree itself (`runtime.js:2442`), so
validation enters a clone holding another repository's v3 config.

**M12. Deleted legacy files' contents are stored nowhere.** *(migration)* The manifest
stores pre-edit contents of what it *modifies*; deletions are recorded as paths. So
`--force` on a gitignored `platformatic.json` destroys it unrecoverably, and on a
no-VCS tree a successful run leaves a `git restore` undo that cannot work.

**M13. The pre-flight's "after the fallbacks above" had no antecedent.** *(migration)*
Fixed while reviewing — the resolution chain is now stated in step 1.

**M14. The standalone-build warning fires on the app's own `PLT_<SELF>_URL`.**
*(convergent: environment + scoping)* Injection covers every application **including
self** (`:1731-1733`), so the warning fires on the variable generator-emitted code
reads, on every scaffolded project. It also requires a source scan only the codemod
has, and cannot match by exact key without the declared ids.

**M15. ~~The plan still specifies the deleted two-directory env rule~~ RESOLVED (S1)** — all three sites (plan step 1, plan step 4, scope step 2) now describe the layered chain. *(original)* *(convergent:
environment + coherence)* `:2810-2812` says "v4 reads exactly two directories" and
"the walk survives only inside migrate"; `:2833-2834` says discovery "keeps v3's
upward walk"; `:665` says "exactly as v3 does". All three contradict the env-root
model.

**M16. Thirteen citations were stale in the abbreviated form.** *(scoping; fixed)*
R7 re-derived only the full `file.js:NNN` form. Fixed in `81525ad1b`.

**M17. The refusal message asserts what the check cannot know.** *(scoping)* `:751-753`
says a filename check "cannot know whether that ancestor is a *root* config"; `:1042`
asserts "`web/api` **is described by** `../../watt.config.ts`". If the ancestor is a
Level 1 app-def it describes nothing of the kind.

**M18. `envfile` replaces which rung — three passages, two answers.** *(environment)*
"the same single rung the app file layer occupies" (whole chain) vs "the application's
own env files **or** its `envfile`, then the rest of its chain" (own directory only)
vs "the app's four-file env set". v3 supports own-directory-only.

**M19. `--env <file>` substitutes a rung the ladder no longer contains.** *(environment)*
v3's `--env` bypasses the search entirely (`configuration.js:349-357`). v4 calls it
"the root rung", which is undefined under a single chained env-files rung, making it
the weakest source rather than an escape hatch.

**M20. A nested runtime cannot own its environment.** *(environment)* "Outermost" makes
`proj/tools/sandbox`'s env root `proj/`, with no way to declare a boundary — including
for every fixture runtime in this repository.

**M21. Topology stripping is boot-style dependent.** *(environment)* Standalone, the
app's own file is the *deciding* file and runs in the root worker, where stripping
"cannot" happen; under a root boot the same file runs in a per-app worker and is
stripped. That is a third boot-style difference, and it falsifies the Summary's "only
which directory's env files".

**M22. Stripping is wrong in the nested-runtime case the document calls legitimate.**
*(environment)* The justification is that the worker "never uses" the value, but the
runtime skips injection when the key is in its own real environment — so the worker
uses precisely the inherited value while the eval worker sees it stripped.

---

## Minors

- **m1.** `$schema` strip is specified only for the root schema; capability schemas
  are `additionalProperties: false` too, so a plain-object `ApplicationDefinition`
  would be required to carry a key that rejects it.
- **m2.** The one example exercising the `$schema` contract is fenced ` ```js `, so
  the fixture gate excludes exactly the shape whose strip is unique.
- **m3.** Appendix A's CI diff covers only the first of its three blocks.
- **m4.** `module` is listed as removed from the root but is top-level in all 13
  capability schemas.
- **m5.** `validationOptions` (`basic/lib/config.js:76`) is a capability export
  carrying `coerceTypes: true`; nothing in the plan flips it, and the `/schema`
  subpath contract does not carry it.
- **m6.** nitro's `entrypoint` is cited as a root-key collision, but `entrypoint` is
  no longer a root key.
- **m7.** `defineCapabilityFactory` is said to take the flatten list; its stated
  signature has no such parameter.
- **m8.** The `db.cache`/`next.cache` example cannot trip the assertion as scoped
  (intra-capability); db has no top-level `cache`.
- **m9.** `enabled` resolution is justified by `production` but specified as keyed by
  `mode`.
- **m10.** "`wattpm` is usually not resolvable from an app directory" is false —
  Node's `node_modules` walk-up resolves it from a root dependency.
- **m11.** `--debug-config --inspect-brk` never says the in-process target's layered
  env view is applied before evaluation.
- **m12.** BC 17 states the refusal unconditionally, dropping the Level 0 branch.
- **m13.** "this is an `await`, not a per-entry resolution step" — a deferred
  definition is a *function*; `await fn` yields the function. The loader must **call**
  it with the context, then await.
- **m14.** Appendix B's report omits the seeded-variables summary step 3 requires.
- **m15.** `id` must be required when `url` is present — v3 enforced it by schema
  (`foundation/lib/schema.js:862` `anyOf`), Appendix A makes it plainly optional, and
  a remote entry's path is computed *from* the id.
- **m16.** Duplicated word at `:790` ("the the rest of its chain").
- **m17.** `mode` travels in `workerData` with no stated consumer, two lines after
  "workers never read env files themselves".
- **m18.** Residual "the nearest files above it" phrasing at `:404-407` and `:1616`.

---

## Decisions needed

| # | Findings | Decision |
|---|---|---|
| S1 | B1, B2 | The env chain's terminator and how an out-of-tree application inherits |
| S2 | B3, M17, m12 | What the ancestor check may veto, and how the refusal is worded |
| S3 | B4, M4 | `portAssignment` into `fastifyServer` too; nitro's missing `http2` |
| S4 | B5, M10, M11 | Step 3: seed persistence, seeding policy, clone exclusion |
| S5 | B6, B7 | Entrypoint classification on pre-rename identity and the `.config` guard |
| S6 | B8, m2, m3 | The fixture gate's real membership |
| S7 | M1, M2, M3 | Three schema/runtime facts the document states wrongly |
| S8 | M5, M6, M8, M9 | id pinning, the deciding-file exemption, autoload collisions |
| S9 | M14, M18–M22 | The remaining environment asymmetries |
| S10 | M12, M15, minors | Rollback contents, the stale plan text, and the minor sweep |
