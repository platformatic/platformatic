# Adversarial review of NEW_CONFIG.md — round 12

**Reviewed:** 2026-08-16, against `384dc8565` (round 11 folded in, 2900 lines).
**Method:** four independent passes — loading/scoping, environment, migration,
contract/coherence — targeting the text round 11 rewrote. Findings deduplicated;
convergent findings (reported by two or three passes independently) are marked.

**Verified personally** before writing this file: the env-file regression (reproduced
on a fixture), the `id` derivation skew, the `useHttp` branch exclusivity, the v4
`_listen` port guard, `v4.0.0.js` having zero mentions of `entrypointPort`,
`next.cache`'s required keys, the audit's deletion of `managementApi`'s string
branch, and the citation drift (`runtime.js` grew 4000 → 4895 lines when
`ca87e5feb` merged main into v4).

**Theme of this round:** round 11's decisions were sound, but several landed only
where they were written. Six findings below are propagation misses from my own
round-11 fixes, and three are regressions those fixes introduced. The document is
now internally inconsistent in more places than it is wrong about the source.

---

## Blockers

### B1. ~~Step 3 rejects migrate's own output~~ — **RESOLVED (R2)**

Validation now seeds a type-appropriate sentinel for **every** variable the emitted
files reference, from the audit's target-type table — not only `requiredEnv` sites —
and names it as the third documented deviation of the migrator-only entry. The
summary reports which values were assumed.

*(original finding)*
*Convergent: migration + coherence passes.*

`:2011-2034` emits `process.env.X ?? ''` for non-strict projects. `:2289-2296`
validates the emitted files "through the real v4 loader". Sentinel injection is
scoped to **`requiredEnv`-wrapped keys only** (`:2304-2307`), which exist only under
*strict* mode — so the default path gets no sentinels.

`logger.level` is `oneOf: [enum[fatal…silent], pattern ^\{.+\}$]`, and BC 7
(`:2394`) deletes the pattern branch. `''` is not in the enum. Appendix B's own
emitted file contains `logger: { level: process.env.PLT_SERVER_LOGGER_LEVEL ?? '' }`,
and that variable is a deployment variable absent from the laptop running the
codemod — which the document itself says at `:1601-1604`.

**Failure:** every project whose v3 generator wrote
`logger: { level: '{PLT_SERVER_LOGGER_LEVEL}' }` (the default —
`service/lib/generator.js:414` pre-`e2da15eda`) fails step 3. Per `:2309-2313` that
is the one failure that does **not** roll back, so the tree is left in the
coexistence state the loader refuses, with nothing actually wrong.

**Fix:** extend sentinel injection to every recorded placeholder-derived position,
typed from the audit's target-type table — not just `requiredEnv` sites.

### B2. ~~The env-file rule regresses the root `.env`~~ — **RESOLVED (R1)**

The env root is now **the outermost `watt.config.*` above the config file**, not a
`package.json` and not "nearest above". Every `.env` from the file's own directory up
to that root layers, nearest winning: no shadowing, bounded by the project rather
than the package, and boot-style independent because the env root is a property of
the project's shape. Intermediate directories participate. The config search keeps
its `package.json` stop — it executes what it finds, which env files do not. All
three contradicting statements (`:1136`, `:1492`, `:1017`) now state this rule, the
ladder rungs are renamed, the dev watcher's set is corrected (m7), and BC 5 states
the four real changes instead of claiming discovery is unchanged (M17).

*(original finding)*
*Environment pass; reproduced on a fixture.*

Round 11's M6 replaced the two-directory rule with "own directory, layered over the
**nearest** env files strictly above". Verified against a real tree:

```
proj/.env          DATABASE_URL=from-root
proj/web/.env      LOG_LEVEL=debug          ← unrelated file
proj/web/api/      the application
v3  → DATABASE_URL=from-root      M6 rule → MISSING
```

`loadEnv` **breaks at the first hit** (`foundation/lib/configuration.js:362-371`) and
is called from the *root config's* directory; the app's own `.env` is applied
separately with no walk (`runtime/lib/worker/main.js:239`). So v3 reads two specific
directories, not "nearest above". Adding one unrelated intermediate `.env` detaches
every application beneath it from the root `.env`. The document asserts the opposite
at `:1497` and `:1023-1024`.

The rule also has **no upper bound**, so a `~/.env` kept for unrelated tooling
becomes a live rung — the trust hole closed for config files, reopened for
environment.

And the same edit left three statements of the rule:

| `:1136` (Loading mechanism) | "the app's env files … **the root's env files**" — pre-M6 |
| `:1492` (Env files) | "own directory … **nearest strictly above**" — M6 |
| `:1017` (Scope) | "walks up from the **deciding file's** directory … runtime additionally reads each application's own" — v3 |

**Fix:** one rule, bounded, that keeps the root reachable. Candidate: *the layered
set of `.env` files from the config file's own directory up to and including the
outermost ancestor containing a `package.json`, nearest winning* — no shadowing,
bounded by the same residual case as the config search, and no "project root"
concept.

### B3. ~~Nothing strips `application.entrypointPort`~~ — **RESOLVED (R3)**

Migrate strips it while noting it. BC 19 no longer credits the upgrade chain, and
states that an in-place upgrade has nothing to strip it and fails loudly on
`additionalProperties`. Step 1 states the general rule: emission drops keys the v4
schemas no longer admit and no chain removes.

*(original finding)*
*Convergent: migration + coherence passes.*

BC 19 (`:2458`) says the upgrade chain deletes `entrypointPort` "from every
capability config". `runtime/lib/versions/v4.0.0.js` is 31 lines and mentions it
**zero** times; it returns early for non-runtime `$schema` (`:12-14`) — exactly the
capability configs where the key lives. No basic-family capability has a `versions/`
directory at all, so no chain could host the deletion.

Plan step 3 removes the key from the schema, `application` is
`additionalProperties: false`, and migrate's only stated behaviour is a
requires-review note — it never drops the key. So a v3 `next` app with
`application: { entrypointPort: 3000 }` emits that key and fails step 3 on migrate's
own output (again without rollback, per B1).

**Fix:** migrate **strips** the key while noting it; BC 19 says the audit removes it
from the schema, and states that an in-place upgrade has no chain to strip it.

### B4. An application directory with no config file silently zero-config boots
*Loading pass.*

The search stops at `web/api`'s own `package.json` and finds nothing; the zero-config
detector *does* recognise the directory, so `:1000-1003`'s error does not fire, and
`:949-962` synthesises `server: { port: Number(process.env.PORT ?? 3042) }` and
boots. Neither the standalone warning nor the scope banner fires — there is no
deciding file to classify or name.

This contradicts `:679-683` ("booting it alone would produce an application
configured by defaults, listening on nothing") and `:621-623` ("silently ignoring its
real configuration — worse than any hard failure"). Round 11's B1 fix makes
`create`/`migrate` always emit per-app files, so this is confined to hand-written
projects — **except** that `:1396` still says migrate emits "files only where
non-default settings exist", contradicting `:1959` and `:2639`.

**Fix:** gate zero-config synthesis on "no `watt.config.*` in any ancestor" (the
ancestor check already exists for the warning) and error naming the ancestor. Fix the
stale `:1396`.

### B5. BC 17 describes the pre-round-11 model
*Loading pass.*

`:2428` — "A directory with no config file of its own **falls through to the nearest
one up the tree, so it boots the runtime**." That is the deleted boundary model; the
search now stops at the nearest `package.json`. `:2427` also states a *third* warning
condition ("when the project holds more than one"), where `:705` defines two.

**Fix:** rewrite BC 17 against the current rule, after deciding B4.

### B6. ~~`managementApi: ''` is invalid~~ — **RESOLVED (R2)**

Appendix B emits `(process.env.PLT_MANAGEMENT_API ?? '') !== ''`. v3's gate is a
truthy test on the *replaced string* (`runtime/lib/runtime.js:341`), so `''` is off
and any non-empty string — including `'false'` — is on; that expression is exactly
that test in a boolean position. The report stays at two notes, because a boolean
position is now faithful and needs none.

*(original finding)*
*Coherence pass.*

`:1663-1666` lists `managementApi`'s top-level string under "**string branch
deleted**", and Appendix A already types it `boolean | ManagementApiOptions`. Appendix
B nonetheless emits `?? ''` and `:2887-2890` defends it as "falsy, therefore off".
With the string branch gone and `coerceTypes: false`, `''` is a validation failure,
not "off". Appendix B ships as a golden fixture (plan step 8), so the fixture cannot
pass.

**Fix:** decide the semantic once — a boolean expression, or record `managementApi`
as a judgment call that keeps a string branch — and correct both places.

### B7. The only illustration of the callback form is schema-invalid
*Coherence pass; verified.*

`:351-358` uses `cache: { adapter: 'redis' }`. `next`'s schema requires
`["adapter","url"]` with `additionalProperties: false`. This is the sole example of
the form `:386` calls "the documented one", and it is outside the golden-fixture set,
so CI as designed would not catch it — the exact recurrence B6/round 11 was meant to
end.

**Fix:** add `url`, and extend the fixture commitment to **every** `ts` block in the
document rather than two of them.

### B8. Resolved remote-app clones deadlock the dirty check, then get their configs deleted
*Migration pass.*

`wattpm resolve` clones into `<root>/external/<id>` (`external.js:441`), which is
untracked. Step 5 refuses to run when an untracked legacy config exists — naming
`external/legacy/platformatic.json` — and the only escape is `--force`, which then
lets migrate write into the clone and **delete** its `platformatic.json`, undone by
the next `wattpm resolve`. The Remote apps section already says such apps migrate in
their own repositories.

**Fix:** exclude the `resolvedApplicationsBasePath` subtree from all five steps by
name; every `url`-bearing entry goes on the other-repositories list whether or not
its directory happens to exist locally.

---

## Majors

**M1. `portAssignment` is a sixth `server` key no schema admits.** *(convergent)* None
of the eight capability schemas contains it; Appendix A lists five and omits it;
`:2163` still argues the five-key subset is why `keepAliveTimeout` must be dropped —
the identical argument applies one paragraph earlier. #5074 is not listed as a plan
prerequisite. **Fix:** add it to `AppServerOptions`, make "five" six, and name #5074
as a prerequisite migrate cannot ship green without.

**M2. ~~The same application gets two different ids depending on boot style~~
RESOLVED (R5)** — one rule everywhere: explicit `id`, else `package.json` `name` with
the scope stripped, else the directory name. `autoload` adopts it too, where v3 used
the directory name alone. That renames autoloaded applications whose package name
differs from their directory — 10 of the 13 named application packages in this repo —
so migrate pins an `autoload.mappings` id for exactly those directories, leaving the
thin root thin everywhere else. BC 25 rewritten. This also reverses half of M12's
resolution, which assumed autoload ids agreed across versions; they no longer do.
*(original)* *(verified)*
Autoload uses the **directory name** (`runtime/lib/config.js:377`); round 11's M15
specified the standalone default as the *package name*. `web/dashboard` named
`@acme/admin-ui` is `dashboard` at root boot and `admin-ui` standalone — different
mesh hostname, different injected variable name, falsifying "a pure function of the
application id, identical at build and run time". My "pre-`e2da15eda`" attribution for
the scope strip is also wrong: `wrapInRuntimeConfig` is still on HEAD at `:130-142`.
**Fix:** default to the directory name, matching autoload; migrate already pins
explicit ids so nothing migrated moves.

**M3. ~~Exposure rule 2 overwrites the public port~~ RESOLVED (R3)** — rule 2 now applies only where rule 1 did not, mirroring v3's `else if`. *(original)* *(verified)* v3's
branches are mutually exclusive — `if (runtimeConfig.server && applicationConfig.entrypoint)
… else if (applicationConfig.useHttp)` (`worker/main.js:258-268` pre-`e2da15eda`). The
document applies rule 2 unconditionally, so an entrypoint with both a root `server`
and a stale `useHttp: true` migrates from port 3000 to `port: 0`, protected from
rule 3's strip. **Fix:** gate rule 2 on rule 1 not having fired.

**M4. ~~No rule covers a v3 entrypoint with no `server` block~~ RESOLVED (R3)** — a fourth rule emits `server: { port: 0 }` with a note; rule 4's carve-out now names rules 2 and 3. *(original)* *(verified)*
v3's `_listen` had no port guard, so it bound an ephemeral port; v4 returns early on
`typeof this.serverConfig?.port === 'undefined'` (`service/lib/capability.js:298-300`).
All three exposure rules are conditional and none fires. **Fix:** a fourth rule
emitting `server: { port: 0 }` with a note.

**M5. A standalone build bakes `undefined` for every sibling `PLT_*_URL`.** *(convergent)*
Injection is one per *sibling*; a standalone boot declares one application. The
standalone-build difference list names only the root `env` block and `envfile`.
`turbo run build` — which the document calls a standalone build — therefore produces
a silently different artifact. **Fix:** add it to both difference lists, and warn when
a standalone build's entry has `dependencies`.

**M6. ~~Every `runtime.js` citation is stale.~~ RESOLVED — all 116 citations
re-derived against HEAD; 0 out of range, corrected ones spot-checked against the
claimed code. Also corrected: the `wrapInRuntimeConfig` scope strip is *still on
HEAD* (`config.js:131-142`), not removed by `e2da15eda` as three places claimed.
The three `config.js` citations flagged as "v4 lines presented as v3" are HEAD-valid
and describe code unchanged since v3, so they are left as HEAD citations.**
*(original finding)* *(convergent, three passes)* The file grew
4000 → 4895 lines in `ca87e5feb`. `buildApplication` 849 → 946, `#showUrls` → 2408,
`getUrls` → 1550, the collision scan → 4845/4874. The document cites the *same*
collision scan correctly at `:896` and wrongly at `:905-907`. Semantics all still
hold; only the numbers moved. **Fix:** re-derive in one pass.

**M7. Appendix A defects beyond round 11's.** `version: string` should be optional —
it makes the documented `{ module: '@platformatic/php' }` escape hatch a type error.
`inspectorOptions` is missing though it survives the audit, so the promised CI diff
fails on day one. `ApplicationEntry.telemetry` is typed as a full override the schema
does not declare. **Fix:** all three, and state that `application` is a declared
addition the diff must allow.

**M8. The factory signature contradicts the deferred contract.** `:420-426` declares one
signature returning `ApplicationDefinition` for both forms; `:386` and Appendix A
declare two overloads where the callback returns `DeferredApplicationDefinition`. A
capability author following the first ships a signature where `next(cb).module`
typechecks — the hazard the second exists to prevent.

**M9. "`$schema` mandatory for machine writers" is unsatisfiable.** Migrate output,
`import` output and per-app factory files cannot carry it — `WattConfig` declares no
`$schema` and the root schema does not admit it. **Fix:** scope the requirement to
plain-object machine-generated roots and say what the next major keys off instead.

**M10. Rollback cannot restore modified files without VCS.** Step 2 edits
`package.json` and the lockfile; step 5 makes `git restore` the whole undo mechanism
while `--force` explicitly covers no-VCS trees. **Fix:** store pre-edit *contents* in
the manifest.

**M11. ~~"Per-app files unconditionally" contradicts url-only entries~~ RESOLVED (R3)** — orchestration-only entries are carved out where the rule is stated. *(original)* There is no
directory to write into, v3 marked them `type: 'unknown'`, and the closure gate has
nothing to measure. **Fix:** state the carve-out where the rule is stated.

**M12. ~~Autoload ids cannot be pinned~~ RESOLVED (R3, amended by R5)** — pinning is scoped to explicit entries, **plus** an `autoload.mappings` id for directories where the package name differs from the directory name, which is exactly where R5's rule moves the id. *(original)* *(verified)*
Pinning would require synthesising a `mappings` entry per directory. **Fix:** scope
the rule to explicit entries; autoload ids already match on both versions.

**M13. Structural-path resolution stops on any fresh checkout of an `import --useEnv`
project.** `.env` is gitignored, so the variable is absent on a clean clone — the
normal state for CI and new contributors. **Fix:** fall back to `.env.sample` and the
`web/<id>` convention before stopping.

**M14. The standalone warning's ancestor test is unbounded.** It walks to `/`, so one
stray `~/watt.config.ts` makes every single-app project under `$HOME` print it — the
noise the app-def half was added to prevent. It also cannot know whether the ancestor
is a root config, yet the text asserts what a root config would have applied.
**Fix:** bound the walk and soften the claim to what a filename check can support.

**M15. `envfile` makes the env model boot-style dependent.** `:1503` promises
"boot-style independent by construction", but an entry's `envfile` suppresses the
app's own files under a root boot and is absent under a standalone one — the same
file evaluating against different sets. `:333` already says this; `:1516` names only
the blocks.

**M16. Topology-key stripping is a third positional difference.** Per-app eval workers
have `PLT_<ID>_URL` stripped; the root worker cannot, so a root-inline entry may read
an inherited value a per-app file cannot. Three "the one thing that differs" claims
do not mention it.

**M17. BC 5 says `.env` discovery is unchanged; it changes in four ways.** Mode
variants, the own-directory rung, intermediate directories participating, and the
removal of v3's cwd fallback. The breaking-changes list is the only section most
upgraders read.

**M18. `envfile` + inline `config` is refused on a rationale the document rejects
elsewhere.** `:1521-1524` explicitly accepts the same asymmetry for root-inline
entries. Since every wrapped single-app project migrates to a root-inline entry, this
turns a v3-supported shape into a hand-conversion refusal.

---

## Minors

- **m1.** `:1126` restates the configured-twice check without the deciding-file
  exemption `:316-320` grants, so read alone it fires on every Level 1 project.
- **m2.** `:1396` still says per-app files are emitted "only where non-default settings
  exist" — contradicts `:1190`, `:1959`, `:2639` and is what makes B4 common.
- **m3.** Step 2's pre-flight list omits two of the five stops, and its "needs only the
  lexical view" justification is false for the ones that need resolved paths.
- **m4.** Step 3 says it skips two things "only", then adds sentinel injection as a
  third, undocumented deviation.
- **m5.** The manifest cannot drive `--resume` through steps 4–5: the legacy-deletion
  set is recorded during the lexical pass, which `--resume` skips. `.wattpm-migrate.json`
  also never exempts itself from the dirty check.
- **m6.** `{PLT_ROOT}` in a structural path resolves empty — it is injected by the
  loader, never present in the environment or `.env`. v3 supported placeholder paths.
- **m7.** The dev watcher's env-file set is "root and app", missing the intermediate
  directory the current rule makes live.
- **m8.** ~~RESOLVED (R2)~~ — a three-row table now splits string / boolean / number-enum emission; booleans get the table's rule and no note. Originally: the boolean-position rule contradicted the typed-coercion rule: `''` cannot
  both survive as a rejection and be coerced by the target-type table.
- **m9.** Two more paths leave the coexistence state undocumented: `--no-install`, and
  a declined install consent.
- **m10.** Migrate flips `wattpm dev` scope in every migrated monorepo and does not say
  so in the report.
- **m11.** Appendix B omits the `id` that step 1 and BC 25 both require migrate to pin —
  and ships as the golden fixture.
- **m12.** `wattpm create`'s "open port question" was closed by the zero-config synthesis
  rule; two places still defer to it.
- **m13.** `:2672` cites "B6's golden fixtures"; the commitment is plan step 8.
- **m14.** The Summary's flagship example uses `url: process.env.REDIS_URL`, which is
  `string | undefined` against a required `string` — it does not typecheck under the
  strict generated types Goal 3 promises.
- **m15.** Non-`runtime.js` citation drift: `foundation/lib/schema.js:877/1083` →
  `894/1100`; `management-handlers.js:116-125` → `:136-146`; `control/lib/index.js:196,213`
  → `:242,259`; `module.js:124-135` → `:129-140`; `worker/main.js:250,253` → `:264-269`;
  `configuration.js:499` → `:512`; `node/lib/capability.js:395` → `:459`;
  `vite/lib/capability.js:215,295` → `:221,303`; `child-process.js:586-597` is unrelated
  (the claim is true by absence).
- **m16.** Several v3 citations in the migrate section are given as current-tree line
  numbers without the `pre-e2da15eda` marker the rest of the document uses.
- **m17.** A missing `envfile` is called a "boot error" though it is now detected during
  configuration load, including under `--debug-config` and `exec`.
- **m18.** "Eager and deferred forms resolve `X` the same way" is absolute, but `ctx.env`
  is a snapshot and `process.env` is live — the document specifies a diff-and-warn for
  exactly that mutation two paragraphs later.

---

## Decisions needed

| # | Findings | Decision |
|---|---|---|
| R1 | B2 | The env-file rule: bounded layered walk, or back to two named directories |
| R2 | B1, B6, m8 | What step 3 seeds for placeholder-derived positions, and `managementApi`'s type |
| R3 | B3, M3, M4, M11, M12 | The five migrate exposure/emission corrections |
| R4 | B4, B5, m2 | Whether a config-less app directory boots, errors, or defers to its ancestor |
| R5 | M2 | Default id: directory name (stable) or package name (v3-faithful) |
| R6 | M1 | `portAssignment` in the schemas + #5074 as a plan prerequisite |
| R7 | M6, m15, m16 | Re-derive every citation against HEAD in one mechanical pass |
| R8 | B7, M7, M8, m14 | Examples and types: fixture every `ts` block, fix Appendix A |
| R9 | B8, M10, M13, m3–m6, m9–m11 | Migrate robustness: clones, rollback, resume, pre-flight |
| R10 | M5, M14–M18 | The remaining environment/scoping asymmetries |
