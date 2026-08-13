# Adversarial review of NEW_CONFIG.md — round 11

**Reviewed:** 2026-08-13, against HEAD `4e5524163` on `feat/new-config-proposal`
(rebased onto `origin/v4`, i.e. post-`e2da15eda`).
**Method:** four independent passes (loading/scoping, environment, migration,
contract/coherence), targeting the text round 10 rewrote. Findings deduplicated;
every source claim re-verified.

---

## First: two reported blockers dissolve, and expose a coordination requirement

Two passes independently reported that the env ladder "inverts v3" — that `loadEnv`
spreads the env file **last**, so a `.env` beats the real environment, making
`real environment > … > env files` a silent behaviour change with no migrate
warning.

That is true of the branch we are on and false of `main`:

```
23215f19e  fix(runtime): let the env file of an application override the one of
           the runtime (#5035)          on main: yes     on v4: NO
```

`main`'s `loadEnv` returns `{ ...envFromFile, ...baseEnv, ...additionalEnv }` with
`kEnvFileFallbackKeys` recording file-only keys — precisely the model this document
specifies. `v4` predates that fix and still has `{ ...baseEnv, ...additionalEnv,
...envFromFile }` and no fallback-key mechanism.

So the findings describe a snapshot upstream has already moved past, in this
document's direction. **The real issue is that `v4` must pick up #5035**, or the
proposal's environment model will not match its target branch when it merges. That
is a release-coordination item, not a design change — but it is load-bearing for
the whole "Env files" section and should be recorded in the implementation plan.

(Verified separately: `process.loadEnvFile` does **not** overwrite existing keys —
tested on Node v24.18.1 — so v3's *worker* layering already behaved as this document
describes even on `v4`. Only the config-evaluation half differs.)

---

## Blockers

### B1. Omitting a per-app config file now silently changes what `dev`/`build`/`start` do there — and both `create` and `migrate` are specified to omit it

Round 10 made owning a config file the *whole* of the scoping rule (`:652-661`).
Nothing in the scaffolding or migration sections was updated, and both are
specified to omit exactly the file that now carries the meaning:

- migrate omits a per-app file when it "would contain nothing but defaults" and the
  detector reconstructs the capability (`:1765-1772`);
- `create` emits one only for non-default options and for applications that need a
  port (`:1634-1638`), i.e. never for a mesh-only `service`/`db`/`node` app;
- every scaffolded application directory nonetheless carries `"dev": "wattpm dev"`,
  `"build"`, `"start"` (`packages/generators/lib/base-generator.js:343-352`, written
  unconditionally from `prepare()` at `:210`), and migrate never touches scripts.

So `pnpm --filter api dev` in a migrated monorepo boots the **entire runtime**, and
`turbo run dev` across N packages starts N full runtimes. That contradicts, within
fifty lines: `:700-702` ("per-app scripts as `wattpm dev` (**that app**)"),
`:666-668` ("`pnpm --filter frontend dev` starts **only** that application"), and
`:747` ("`turbo run build` is a standalone build").

The deeper collision: the omit-defaults gate deletes a file *because* it would
contain nothing but defaults, but under round 10 a defaults-only `watt.config.ts`
is not redundant — it is the scope declaration (`:661`).

**Fix direction:** make per-app file emission unconditional for every application in
a multi-app project, in both `create` and `migrate`, and say why in the
omit-defaults paragraph; or drop the per-app scripts from scaffolding and have
migrate report every directory whose script now boots the runtime.

### B2. The deferred root-inline context cannot be built where the document builds it — the ladder needs provenance the protocol deliberately withholds

`:371-378` runs the resolution pass **inside the root eval worker**, giving each
function-valued entry a context of "the root env view plus the root and entry `env`
blocks". `:1089-1096` states the counter-constraint: "The protocol carries no
environment… Provenance never travels either… there is no `envFileKeys` and no
`injectedKeys` in `workerData`."

Applying `real env > entry block > root block > root env files` requires knowing,
per key, whether a value came from the real environment (must beat the blocks) or
from the root `.env` (must lose to them). The worker holds one flattened map. With
`/app/.env` supplying `DATABASE_URL` and a root block also supplying it, treating
the map as the top rung gives the file (wrong); overlaying the blocks
unconditionally gives the block — and in the mirror deployment where the real
environment sets the key, that re-introduces exactly the v3 pinning breaking change
18 removes.

The pass cannot move main-side: the callbacks are closures in the worker heap and
cannot cross `structuredClone`. And it is not optional — `:1829-1836` makes the
deferred form the migration target for *every* wrapped single-app project.

**Fix direction:** carry the layered sources (or at least the real-env key set) into
the root worker's `workerData` and amend "the protocol carries no environment"; or
make the pass a second round trip — the worker posts entry ids and referenced keys,
the main process replies with one resolved `env` per entry.

### B3. Three places say root-inline entries never see the `env` blocks; the mechanism migrate depends on requires that deferred ones do

`:1315-1319`, `:1371-1373` and breaking change 5 (`:2031-2033`) all state the
exclusion unconditionally — "the root config's own evaluation and root-inline
entries are excluded, as in v3". `:371-378` and `:1829-1836` require the opposite
for the deferred form, and call it the faithful target for a v3 config whose
placeholders resolved from a block.

An implementer following the normative "Env files" section builds a loader in which
every migrated wrapped single-app project resolves its `env`-block values to `''`.

The "as in v3" clause is also false in the case that matters: `env` is absent from
`runtimeUnwrappablePropertiesList` (`foundation/lib/schema.js:1591-1601`), so
`wrapInRuntimeConfig` hoists `runtime.env` and the v3 worker applied it before
re-parsing the same file.

**Fix direction:** narrow the exclusion in all three places to *eager* root-inline
entries, and state that the deferred form receives the blocks. Same edit for
`:1220-1221`.

### B4. Migrate's `useHttp` emission is rejected by every basic-family `server` schema — step 3 fails on migrate's own output

Rule 2 (`:1877-1886`) emits `{ port: 0, hostname: '127.0.0.1', keepAliveTimeout: 5000 }`
— a faithful copy of v3's synthesized block (`worker/main.js:262-267`
pre-`e2da15eda`). But `keepAliveTimeout` exists only in the `service`/`db`/`gateway`
schemas. Verified: `packages/next/schema.json` and `packages/node/schema.json` admit
exactly `backlog, hostname, http2, https, port` under `server`, with
`additionalProperties: false`.

v3 fed that block to `deepmerge` in the capability constructor, never through a
capability schema, so the key was simply inert. In v4 it is a validation failure, so
**no `useHttp` project on a basic-family capability can be migrated at all** — and
v3's own docs recommended `useHttp` for Express-style apps, which are
`@platformatic/node`.

**Fix direction:** emit only the keys the target capability's `server` schema admits;
add a migrate test per capability family asserting the emitted block validates.

### B5. Lexical entrypoint resolution ignores v3's `enabled` splice, dropping the root `server` block from projects that were publicly reachable

v3 splices disabled applications out (`runtime/lib/config.js:413-417`) **before**
entrypoint auto-detection (`:436-463`). Migrate resolves the entrypoint from the
lexical view, where "every authored application is present regardless of the
migration-time environment" (`:1730-1734`).

With two applications, one `enabled: false`, and no explicit `entrypoint`: v3 has one
survivor, which becomes the entrypoint and binds the root port. Migrate sees two,
concludes "does not resolve", and drops the root `server` block on the stated
grounds that "v3 booted mesh-only" (`:1855-1860`) — false here. If the survivor is a
framework capability it now does not start at all.

**Fix direction:** replay the splice — resolve the entrypoint after applying
`isApplicationEnabled` for each of `production` and `development`. If the two
disagree, refuse and name it rather than dropping silently.

### B6. The Level 2b example and Appendix B are both invalid against the rules they illustrate

**Level 2b** (`:272-280`) passes `telemetry` to `node()`. Verified:
`packages/node/schema.json` has no top-level `telemetry` — only `service`, `db` and
`gateway` do — and capability schemas keep `additionalProperties: false` (`:451-453`).
The example fails validation at load, and it is the *sole* illustration of the
entry/factory split, which the next paragraph leans on.

**Appendix B** (`:2401-2447`), the only worked migrate output, breaks four of
migrate's own rules: bare `process.env.X` where `?? ''` is required (`:1770-1774`),
an unexplained `3042` default, a hardcoded `'info'` where "nothing is ever inlined"
(`:1815-1817`), and a dropped `managementApi` — which is a behaviour flip, since v3
with the variable unset ran with the management API **off** and the migrated project
turns it **on**.

**Fix direction:** make the Level 2b app a `service`/`db`, regenerate Appendix B from
the rules, and add both to CI as golden fixtures validated against the shipped
schemas.

---

## Majors

### M1. `@platformatic/nitro` does not exist; five claims rest on it, one being the justification for classification rule 2

`git ls-files packages/nitro` is empty — the directory is an untracked leftover
containing only `node_modules`. There is no nitro package, schema, or detector entry.
Affected: `:429-432` and `:434-437` (the multi-block flattening list), `:437-439`
("nitro's block contributes both `outputDirectory` and `entrypoint`"), `:624-627`
(classification rule 2's second example for why there is no key-collision check),
`:1060` ("the existing Nitro-before-Vite ordering" — `applicationTypes` has no such
entry), and `:2207-2208` (13 capabilities; there are 12).

**Fix direction:** delete every nitro reference or replace it with a real package.
Rule 2 needs a second real example or should stand on `gateway({ applications })`
alone.

### M2. The specified detector table cannot reconstruct `@platformatic/tanstack`, refuting the omit-defaults soundness argument

`:1064-1071` argues omit-defaults is sound because "the detector provably
reconstructs the wizard's choice". `create-wattpm` offers `@platformatic/tanstack`
(`packages/create-wattpm/lib/index.js:35`), and a scaffolded tanstack app declares
both `@platformatic/tanstack` and `vite`. `applicationTypes`
(`foundation/lib/module.js:15-38`) has no tanstack entry, so framework inference
resolves `vite` → `@platformatic/vite`. `@platformatic/nuxt` and
`@platformatic/react-router` are in the same position.

**Fix direction:** enumerate the v4 table explicitly, adding tanstack, nuxt,
react-router and node; add a test asserting `detect(scaffold(c)) === c` for every
entry in `internalCapabilities`.

### M3. The v4 upgrade chain does not delete `useHttp`, and the document claims it does twice

`:751-756` and breaking change 19 (`:2095-2098`) both say the chain deletes
`entrypoint`, root `server`, entry `server`, `useHttp` and `portAssignment`, citing
`runtime/lib/versions/v4.0.0.js:16-27`. That file deletes entry `server`, mapping
`server`, `config.entrypoint` and `config.server`. It never touches `useHttp`;
`portAssignment` goes only incidentally, nested inside `server`. The entry schema has
no `additionalProperties: false`, so a surviving `useHttp: true` is silently ignored
— the application that had real TCP on v3 gets none, with no diagnostic.

**Fix direction:** add `delete application.useHttp` to the chain and keep the claim,
or narrow both sentences and state that migrate's lexical rule is the only handler.

### M4. The boundary collapse re-introduces the marker-less-container regression the deleted text named, and it is now silent

Round 10 removed the "Locating is not executing" paragraph — which existed to stop
the boundary collapsing onto an app directory in marker-less trees — and replaced it
with "The boundary bounds everything" (`:915-916`), without touching the boundary
rule or the claims that depended on the mitigation.

In `/app` with no `.git` (routinely `.dockerignore`d) and no `workspaces`, `WORKDIR
/app/web/api` gives boundary = `/app/web/api`. Consequences, none stated: the root
`.env` is never read; no standalone warning fires (the deciding file *is* topmost
within the boundary, so `:685-687` suppresses it); and with no per-app file the walk
fails outright with "no watt.config.* found within a project boundary" where v3
climbed to `/app` and booted.

**Fix direction:** restore a filename-only probe for the env root and the warning
while keeping execution bounded, or anchor the fallback on the **topmost**
consecutive `package.json` chain — and state the `.dockerignore`d-`.git` hazard in
the migration guide.

### M5. "Project root" is defined twice, incompatibly, and one definition deletes the root `.env` the standalone warning promises

The walk (`:642-645`) says the project root is the **topmost config within the
boundary**. The boundary section (`:916-917`) and "Env files" (`:1334-1336`) say the
**deciding root config's directory**. These differ for every standalone boot, where
the deciding file is an app-def and there is no "deciding root config" at all.

Read literally, the latter gives a standalone boot no root env rung, contradicting
the warning's own "Root .env files still apply" (`:681`). Round 10 also deleted the
guard that made this safe — that the topmost file's classification is unknown when
`loadEnv` runs — and then introduced a phrase asserting that classification.

**Fix direction:** use "the topmost `watt.config.*` within the boundary" everywhere,
and stop calling it a root config.

### M6. The root worker's env is specified as the project root's files only, dropping the deciding file's own directory

`:988-990` builds the root worker's env from "the project root's env files". Under a
standalone boot the app's own file *is* the root worker's file, so
`web/frontend/watt.config.ts` evaluates with `/repo/.env` only — contradicting step
(2) (`:645-647`) and the explicit promise at `:1361-1367` that the colocated file
reads `web/frontend/.env`.

**Fix direction:** restate as "the deciding file's directory's env files over the
project root's — the same two-directory ladder every worker uses".

### M7. The corrected build rule contradicts itself in adjacent paragraphs

`:719-724` says a build resolves the environment "exactly as it is for that
application's workers… there is no reduced or special build environment", citing
that builds run in a normally spawned worker. `:730-733` then removes the injected
`PLT_<ID>_URL` rung. A normally spawned worker's env *includes* that rung, so
excluding it means `wattpm build` constructs workers differently from `wattpm start`
— which is a special build environment, and a third variant against the
"one implementation of the ladder" claim.

It also silently breaks `:1415-1417` ("Existing app code reading
`process.env.PLT_API_URL` keeps working") inside a build, while `dev`-time
compilation inside a serving worker *does* see injected URLs.

**Fix direction:** state the build environment as the worker ladder minus the
injected rung, computed by the same resolver with that rung disabled, and note the
`dev`/`build` divergence.

### M8. The `PLT_<ID>_URL` strip is impossible for the root eval worker, which the text claims it covers

`:1441-1445` says the loader strips the exact topology keys "from **every** eval
worker's environment". The declared ids come from the root config's entries and from
`autoload` expansion, both of which happen *inside* the root worker (`:996-999`),
strictly after its env is fixed at construction (`:988-991`). A stale
`PLT_API_URL` in `/app/.env` is therefore readable during root evaluation and gets
baked — the exact failure the strip exists to prevent — and `--debug-config` prints
it as if it were a real boot's.

**Fix direction:** scope the strip to per-app workers; handle the root worker with a
post-unwrap check that rejects or warns.

### M9. "Config-time and runtime env agree by construction" is false for root-inline entries, and the plan asserts it as a test

`:402-404`, `:1090-1093` and implementation step 1 (`:2163-2164`) state it
unqualified; `:1352-1359` concedes the opposite. A root-inline `node({ dsn:
process.env.DSN })` evaluates in the root worker (root `.env`) while its worker
resolves app files above root files — permanently divergent, for the shape migrate
emits for every wrapped single-app project.

**Fix direction:** qualify all three to "for applications configured by a per-app
file", and scope the test the same way.

### M10. The standalone warning's new trigger fires on full-runtime boots

Round 10 replaced the trigger with "the deciding file is not the topmost config
within the boundary" (`:673-676`) — which has no standalone condition. A nested
*root* config (a second runtime under `tools/sandbox`) satisfies it, so the user is
told an application is booting standalone and the mesh is unavailable while a full
runtime with a working mesh boots.

**Fix direction:** restore the standalone condition — deciding file classifies as an
app-def **and** a config exists above it.

### M11. `wattpm resolve` cannot load a configuration whose remote applications are unresolved — the only state in which it runs

`:562-569` makes a missing backfilled directory a load-time failure ("run `wattpm
resolve`"). `resolveApplications` loads the configuration first
(`wattpm-utils/lib/commands/external.js:413`), so on a clean checkout `wattpm
resolve` fails telling you to run `wattpm resolve`. Migrate step 3 has the same
deadlock over its own emitted output.

**Fix direction:** per-app discovery skips entries whose directory does not exist
yet, recording them unresolved (v3's `type: 'unknown'`); only `dev`/`start`/`build`
promote that to an error.

### M12. "The boundary bounds … path resolution" silently outlaws `path: '../…'`

`:915-916` says nothing above the boundary is "read, run, or consulted". 50 in-tree
configs carry `"path": "../…"`. Nothing states whether such an entry is refused,
skipped, or exempt — and `resolveApplications` already has its own containment check
against a *different* anchor (`external.js:446-451`, `startsWith(root)`).

**Fix direction:** narrow the sentence to the walk, and state that directories a
config names are trusted wherever they resolve.

### M13. Migrate has no rule for `{PLT_APPLICATION_<ID>_PATH}` entries — the shape `wattpm import` writes

`import` writes `path: '{PLT_APPLICATION_X_PATH}'` plus an empty `.env` line
(`external.js:243-271`). Naive conversion yields `path: ''`, which resolves to the
project root, where per-app discovery finds the root config and raises "configured
twice". Worse, migrate needs a concrete path *before* emission — to place per-app
files, run the detector, rebase `envfile`, and evaluate the root-directory `envfile`
refusal — none of which is expressible over a token.

**Fix direction:** state that migrate resolves `path`, `autoload.path`, `envfile` and
`resolvedApplicationsBasePath` against the migration-time environment plus the root
`.env`; drop a remote entry's placeholder path rather than converting it; stop on a
path that resolves empty.

### M14. `application.entrypointPort` survives and rewrites the reported port, contradicting "custom listeners are observed, never rewritten"

`packages/basic/lib/schema.js:61-63` still carries it, and
`basic/lib/capability.js:899-912` overwrites the reported URL's port. That URL is the
only input to the collision machinery (`runtime.js:4029-4079`), so two applications
on distinct ports both setting `entrypointPort: 3000` raise a spurious
`AddressInUseError`. It appears in no exposure rule and no audit list.

**Fix direction:** decide its fate in the schema audit — it is entrypoint-era
vocabulary for a removed concept — and state how the collision scan treats it.

### M15. Migrate never pins the application id, and v4's default differs from v3's in two ways

v3 derives the id from `package.json` `name`, **strips the scope**, and falls back to
`'main'` (`runtime/lib/config.js:132-142` pre-`e2da15eda`). v4's default is "the
package name (directory name when absent)" (`:662-666`). So `@acme/frontend` becomes
`@acme/frontend` and a nameless package becomes its directory name — changing the
mesh hostname, the injected `PLT_<ID>_URL`, the metrics label, and the argument
`wattpm inject` now requires. No breaking-change entry.

**Fix direction:** have migrate emit the resolved `id` explicitly on every entry.

### M16. Rule 1 moves the root `server` block "verbatim", but `portAssignment` exists in no v4 capability schema

The v3 root `server` includes `portAssignment`; no capability `server` block admits
it. "Verbatim" therefore emits a config that fails step 3.

**Fix direction:** state that rule 1 drops `portAssignment` with a requires-review
note, and that "verbatim" means the five shared keys.

### M17. `--no-install` tells the user to run the install; `--resume`'s dirty check then blocks on the lockfile that install writes

The manifest holds files migrate created or modified (`:1983-1985`); the lockfile is
modified by the user's install and is not exempt, so `--resume` refuses.

**Fix direction:** pre-record the lockfile and `package.json` in the manifest at
`--no-install` time, and say whether `--resume` runs the install itself.

### M18. Appendix A type errors against the shipped schemas

`nodeModulesSourceMaps` is declared `boolean` at both levels (`:2301`, `:2349`);
verified `array of string` (`foundation/lib/schema.js:933-936`, `:1534-1538`).
`exitOnUnhandledErrors` is `boolean | number` (the number being the exit delay).
`policies` declares `required: ['deny']`, so `deny` is not optional.

**Fix direction:** correct all three, and generate the sketch mechanically from
`packages/runtime/schema.json`.

---

## Minors

- **m1.** `:374-375` builds the deferred context from "that entry's `envfile` when it
  declares one" — a combination `:1385-1387` makes an error. Round 10 fixed only the
  migrate side. Delete the clause.
- **m2.** `:402-404` still says "the worker-boot env reader loads the same layered
  file set", contradicting `:989-991` ("workers … never read env files themselves").
- **m3.** `--debug-config`'s spawn-ordering precaution (`:1167-1171`) is obsolete
  under explicit-env workers.
- **m4.** A deferred entry in a programmatic config source hits canonicalization's
  function hard-error, since the resolution pass is described only as a root-worker
  step.
- **m5.** `ctx.env` is documented as a snapshot of `process.env` (`:409-411`,
  `:2368`), but for a deferred entry it is a synthetic per-entry view that disagrees
  with the worker's actual `process.env`.
- **m6.** Whether the `NODE_ENV` bottom rung applies to eval-worker environments is
  unstated, and load-bearing for deferred contexts.
- **m7.** Startup reporting is stated per-worker at `:824-828` and per-application at
  `:878-889`; the sample output prints `frontend mesh-only` while the example it
  borrows from gives frontend `port: 0`.
- **m8.** BC 17 over-claims `--config` ("boots the full runtime"); it boots whatever
  the named file describes.
- **m9.** The configured-twice error is now unreachable from the app's own directory,
  relocating rather than preventing the split it exists to stop.
- **m10.** The ancestor-eligibility rule is no longer stated for the topmost search.
- **m11.** Step (3) still executes "candidates" (plural) and leans on a classification
  cache with no second consumer.
- **m12.** `enabled` has no defined meaning for a standalone boot; the warning's list
  of unapplied root settings also omits `workers`, `enabled`, `dependencies`, `health`.
- **m13.** `GET /metadata` "extended with `root`" duplicates the existing `projectDir`.
- **m14.** `wattpm import`'s output changes have no breaking-change entry.
- **m15.** `:1140-1142` reads as putting `transform()` main-side, contradicting
  `:1196-1206`.
- **m16.** `ConfigContext` is declared in the `// wattpm` block though it lives in
  `@platformatic/basic`; `DeferredApplicationDefinition` is referenced but never
  defined.
- **m17.** The `module`-identified emission branch rests on a false premise and is
  unreachable — out-of-closure modules are already refused pre-flight.
- **m18.** The boolean table's `watch` example is ambiguous between two opposite v3
  rules (runtime-dialect `=== 'true'` vs capability-dialect truthy).
- **m19.** The placeholder grammar is wider than `{PLT_X}`:
  `/(?:\{{1,2})([a-z0-9_]+)(?:\}{1,2})/i` (`foundation/lib/configuration.js:28`).
- **m20.** Step 3 and step 5 disagree on what a validation failure leaves behind.
- **m21.** `enabled` does not gate `requiredEnv` for root-inline entries, since the
  resolution pass runs before the splice.
- **m22.** Non-recognized legacy filenames (`applications[].config` accepts any name)
  are read but never deleted by step 5.
- **m23.** "Structurally unreachable" is asserted absolutely, but hot-add can name an
  absolute path above the boundary by design.
- **m24.** `:745-748` points at "How applications are exposed" for the block/`envfile`
  standalone asymmetry, which is documented in "Env files".

---

## Decisions needed

| # | Finding(s) | Decision | Status |
|---|---|---|---|
| R1 | env drift | Get #5035 onto `v4`, or restate the ladder against v4's current `loadEnv` | **open** |
| R2 | B1 | Per-app file emission unconditional, or drop per-app scripts | **open** |
| R3 | B2 | How the deferred context gets provenance | **open** |
| R4 | B3, m1 | Narrow the root-inline exclusion to the eager form | **open** |
| R5 | B4, M16 | Emit only schema-admitted `server` keys | **open** |
| R6 | B5 | Replay the `enabled` splice in entrypoint resolution | **open** |
| R7 | B6 | Fix both examples; add golden fixtures | **open** |
| R8 | M1, M2 | Correct the capability inventory and enumerate the detector table | **open** |
| R9 | M4, M5, M6, M10 | One project-root definition; restore the env probe or accept the container regression | **open** |
| R10 | M7, M8, M9 | Build rung, strip scope, and the agree-by-construction claim | **open** |
| R11 | M11, M12, M13 | Unresolved remote entries; path containment; placeholder paths | **open** |
| R12 | M3, M14, M15, M17, M18 | Chain/`useHttp`, `entrypointPort`, id pinning, `--resume`, Appendix A | **open** |

Minors m1–m24: apply directly.
