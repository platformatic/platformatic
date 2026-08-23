# Adversarial review of `NEW_CONFIG.md` — round 22

## Verdict

Seven concrete gaps remain. Four are implementation blockers: the target mode for `resolve` still has two incompatible defaults, candidate validation is scoped by id rather than clone destination, the port preflight claims ports that custom commands never use, and migration can exclude ordinary local applications merely because they live under `resolvedApplicationsBasePath`.

## Blockers

### 1. Bare `resolve` still has two incompatible mode contracts

The new command-specific design says `--for` defaults to `start` and evaluates that command with its own defaults (`NEW_CONFIG.md:688-694`), so bare `wattpm resolve` must use `command: 'start'`, `mode: 'production'`, and `production: true`. Five paragraphs later, the mode rule says resolve's flags default to development like other `exec` commands and tells production users to pass `--production` (`:723-729`). The implementation plan repeats the first contract (`:4520-4525`).

This changes topology, not just diagnostics. Given a root callback that returns one remote under `mode === 'production'` and another under development, one reading of bare `wattpm resolve` fetches what the default `wattpm start` will boot; the other fetches the development application and leaves start unresolved. No implementation can satisfy both statements.

**Required correction:** retain the target-command rule and remove the `exec`-default wording. State explicitly that `--for dev`, `--for start`, and `--for build` inherit their target's mode/production defaults, while explicit `--mode`/`--production` override them. Define `--for all` the same way per target.

### 2. Clone-destination conflicts are checked only within one id

The proposal now compares effective destinations when the **same id** appears under different commands (`NEW_CONFIG.md:707-715`, `:770-784`), and the implementation plan unions candidates by id (`:4523-4526`). It never checks whether **different ids** claim the same destination.

This valid root shape passes the stated id checks:

```ts
applications: [
  { id: 'api', url: 'https://example.test/api.git', path: 'external/shared' },
  { id: 'billing', url: 'https://example.test/billing.git', path: 'external/shared' }
]
```

Current resolution collects every missing destination before cloning, then clones sequentially (`packages/wattpm-utils/lib/commands/external.js:422-478`). Both candidates enter `toResolve`; the first clone creates the directory and the second clone fails into it. On a later run, the existing-path check skips both (`:427-429`), so the URL/path mismatch is not repaired and one application can boot the other repository's checkout. This is the same class of local-path/URL inconsistency the duplicate-id merge rule already rejects at `NEW_CONFIG.md:347-361`.

**Required correction:** build a canonical destination-to-producers map across all candidates, not only an id-to-command map. Refuse one destination claimed by different effective repository/revision pairs, naming both ids. If identical repository/revision pairs may intentionally share a checkout, specify and test a single-clone path for them.

### 3. The port preflight treats dead `server.port` values as occupied

The preflight claims every nonzero declared `server.port` range (`NEW_CONFIG.md:1252-1269`). But framework capabilities check the active mode's custom command **before** their server configuration and return through `startWithCommand`; the proposal documents that precedence at `NEW_CONFIG.md:1355-1365` and `:1425-1436`, and Next implements it at `packages/next/lib/capability.js:198-212` and `:312-327`. In that branch the capability never binds `server.port`; the command chooses and reports its own address.

Two Next applications can therefore carry the same otherwise-valid default `server.port` while their production commands bind distinct addresses. The load-time range check rejects them before either command runs, even though neither claimed range can be bound. The omitted-host rule makes this especially direct: same capability + both hostnames omitted is treated as overlap (`NEW_CONFIG.md:1280-1293`).

**Required correction:** construct the preflight set from managed listeners that the selected command will actually use. For framework applications whose active-mode custom command takes precedence, omit the capability `server.port` and leave collision detection to the runtime's observed-listener scan. Add dev/start tests because the selected custom command is mode-specific.

### 4. Excluding the whole resolution base can exclude real local applications and migration inputs

Migration excludes the entire `resolvedApplicationsBasePath` subtree from its lexical pass, dirty check, emission, source scan, and deletion set (`NEW_CONFIG.md:3141-3153`). The v3 schema accepts any string for this setting and imposes no dedicated-directory constraint (`packages/foundation/lib/schema.js:1541-1544`). A valid project can therefore use `resolvedApplicationsBasePath: 'applications'` while also keeping local applications under `applications/api`, or even use `'.'` so unresolved clones land directly under the root.

In the first case, the blanket exclusion hides the local app's legacy config from classification and prevents its required per-app v4 file from being emitted. With `'.'`, the exclusion covers the transaction root itself. The later containment check (`NEW_CONFIG.md:3656-3686`) only decides whether a path escapes the transaction; it does not detect an exclusion swallowing files migration must process.

**Required correction:** exclude only canonical directories belonging to `url`-bearing resolved entries, not the configured base wholesale. Before writing, reject any remote exclusion that overlaps a local application, a migration input, or a planned output. Test a shared `applications/` base and `resolvedApplicationsBasePath: '.'`.

## High-priority correctness issues

### 5. The standalone-build section omits its third divergence and gives a wrong fix for topology URLs

The build section says standalone differs in two ways and that a missing sibling URL always becomes `undefined` (`NEW_CONFIG.md:1110-1125`). The env section later says there are **three** differences and explicitly names topology-key stripping: a per-app file is stripped during a root boot but is unstripped when it becomes the standalone deciding file (`:2410-2429`). The build section is also internally contradictory about diagnostics, first saying migrate already computes the `PLT_*_URL` reads and then saying its source scan does not cover them (`:1116-1124`).

There are two concrete branches, and only one yields `undefined`. If no source supplies `PLT_API_URL`, standalone code sees `undefined`. If an app env file contains a stale `PLT_API_URL`, a root build's worker environment replaces it with the injected mesh URL, while a standalone build has no sibling injection and keeps the file value. During config evaluation, the root-directed per-app worker strips that file key, while the standalone root worker cannot. The artifact or `resolvedConfig` can therefore contain the stale URL rather than `undefined`.

The stated durable fix—put build input in the app's own env files (`NEW_CONFIG.md:1129-1130`)—is consequently wrong for topology keys: root injection outranks that file, while standalone has no injection, so the two builds still differ unless the file happens to duplicate the mesh URL.

**Required correction:** make the build section list all three divergences and describe both absent-key and stale-file branches. Remove the contradictory source-scan claim. Recommend a root-directed build when sibling mesh URLs are required; for genuinely standalone builds require an explicit real-environment value or application-specific non-topology setting rather than claiming an app env file restores equivalence.

### 6. The watcher omits the ancestor configuration candidates that determine the env root

The ancestor filename scan is behavioral: adding or removing an ancestor `watt.config.*` changes the env root and can change callback results, ports, and whether evaluation throws (`NEW_CONFIG.md:1023-1037`, `:1597-1602`). The watcher claims to include all non-import inputs but names config-file candidates only in application directories (`:2016-2028`). An ancestor file used solely as the env-root delimiter is neither an imported file nor an application's config.

For example, start `wattpm dev` in a standalone app whose own file is currently its env root, then create `../watt.config.ts` and `../.env`. Neither path is in the original active env-file set, and the new ancestor candidate is not in the enumerated config-candidate set, so no reload is required by the current contract. Restarting Watt discovers the ancestor and evaluates against a different environment. Deleting an existing outermost ancestor has the symmetric stale-env-root failure.

**Required correction:** watch every recognized v4 candidate path consulted by the ancestor/env-root scan, including absent candidates for creation, and the legacy candidate set if its appearance changes the standalone warning. Recompute the env-file and watcher sets atomically after any such event. Add create/delete tests above a standalone package boundary.

### 7. The advertised migration command is not pinned to the v4 migrator

Every legacy error and the migration section instruct users to run unqualified `npx wattpm-utils migrate` (`NEW_CONFIG.md:12-15`, `:839-846`, `:2937-2946`). That does not identify the migrator major. A project with a local v3 `wattpm-utils` can have `npx` select that binary; the package at current HEAD is `3.67.0` (`packages/wattpm-utils/package.json:1-3`) and its command switch has no `migrate` case, so it reports an unknown command (`packages/wattpm-utils/index.js:48-89`). Once v5 is latest, a project without a local copy can instead receive the v5 utility even though this proposal says the frozen v3 reader is private code maintained for the life of v4 (`NEW_CONFIG.md:2972-3001`).

This contradicts the claim that invocation-time resolution makes post-GA v4 fixes reliably reach every installed v4 runtime. Invocation time selects *a package version*; without a major constraint it does not select the v4 line.

**Required correction:** use `npx wattpm-utils@4 migrate` in every diagnostic and guide, and have resume/report commands preserve that major. This still receives the latest v4 migrator fixes while avoiding both a locally installed v3 binary and a future latest major.
