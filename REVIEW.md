# Adversarial review of `NEW_CONFIG.md`

## Findings

### P1 — design blockers

1. **Deferred configs run before disabled entries are filtered.**  
   `NEW_CONFIG.md:1357-1376` invokes deferred `applications[].config` callbacks before autoload expansion and `enabled` resolution, while `NEW_CONFIG.md:1386-1401` promises the opposite. A disabled callback can therefore throw or fetch secrets.  
   **Fix:** canonicalize while preserving deferred slots → validate orchestration → expand/filter → invoke callbacks only for survivors.

2. **Topology invariance is neither enforceable nor compatible with “evaluate once.”**  
   `NEW_CONFIG.md:633-645` evaluates twice—`exec/development` and `start/production`—but `NEW_CONFIG.md:1647-1655` guarantees one evaluation. Two samples also miss `build`, `dev`, and arbitrary modes such as `staging`. Worse, a supported remote with `enabled: { development: false, production: true }` remains invisible to `resolve`.  
   **Fix:** make topology static/inspectable, or weaken the guarantee. At minimum, `resolve` must collect declared remote entries before `enabled` filtering.

3. **Classification occurs before the supposedly authoritative snapshot exists.**  
   Classification reads `module`, `application`, `applications`, and `autoload` at `NEW_CONFIG.md:699-724`; auto-wrapping also happens before canonicalization at `NEW_CONFIG.md:1352-1359`. This contradicts `NEW_CONFIG.md:1685-1698`, which says classification uses the canonical snapshot and nothing reads the original object first. Accessors and Proxies reopen the stated TOCTOU hole.  
   **Fix:** invoke a top-level function, canonicalize its result, then classify and auto-wrap only the snapshot.

4. **Custom-command presence cannot prove an application serves traffic.**  
   `NEW_CONFIG.md:1113-1159` treats either development or production command as load-time proof. Next selects only the active command (`packages/next/lib/capability.js:198-210,310-327`), and an arbitrary command may never bind a socket; `startWithCommand()` waits for a URL event (`packages/basic/lib/capability.js:548-604`).  
   **Fix:** validate only the active command and define listening as a runtime readiness observation subject to timeout.

5. **Numeric placeholder migration introduces a listener where v3 failed closed.**  
   `NEW_CONFIG.md:2542-2565` emits `Number(process.env.PORT ?? '')`; an unset value becomes port `0`. The stated reason not to use a guard is incorrect: `Number(requiredEnv('PORT'))` preserves both configured deployments and v3’s unset-variable failure. A warning is insufficient for this behavioral change.

6. **Structural-path migration uses the wrong v3 environment lookup.**  
   `NEW_CONFIG.md:2814-2831` consults a “root `.env`”. V3 actually takes the first `.env` walking upward from each config directory, then falls back to `process.cwd()/.env` (`packages/foundation/lib/configuration.js:344-380`). Migration can therefore emit the wrong literal path or incorrectly use `.env.sample`.  
   **Fix:** reuse the vendored v3 `loadEnv` semantics for each file.

7. **The migration closure is incomplete.**
   - V3 allows `--config config.yaml`, but migrate exposes no explicit input path and only discusses recognized candidates (`NEW_CONFIG.md:674-694,2313-2327`; current bypass at `packages/foundation/lib/configuration.js:196-225`).
   - `ImportGenerator` still emits and mutates JSON (`packages/generators/lib/import-generator.js:126-201`) and is used for capabilities without generators (`packages/create-wattpm/lib/index.js:416-432`), but is absent from the writer inventory and implementation plan.

   **Fix:** add `migrate --config` and explicitly convert `ImportGenerator`.

### P2 — must resolve before freezing the contract

8. **The file-version mechanism is not enforceable.**  
   `NEW_CONFIG.md:2140-2161` distinguishes machine-generated plain objects from human ones, which runtime evaluation cannot reliably observe. Importing `defineConfig` also does not record the authored major: a v4 file run with v5 installed imports v5.  
   **Fix:** require an explicit serializable format marker, or make `defineConfig` return branded metadata. Otherwise describe `$schema` as a convention, not detection.

9. **Migration’s “complete” divergence inventory is incomplete.**  
   Every carried `env` key changes precedence and gets a warning (`NEW_CONFIG.md:2798-2800`, BC 18), but this is absent from the supposedly exhaustive divergence list at `NEW_CONFIG.md:2981-3002`. Also, `NEW_CONFIG.md:1800-1807` says values from `envfile` stop resolving, while `NEW_CONFIG.md:1950-1960` says per-app `envfile` governs evaluation and runtime. Narrow the former claim and add precedence inversion to the exhaustive list.

10. **Migration has no unambiguous transaction commit point.**  
    Lifecycle failure leaves migration “complete” at `NEW_CONFIG.md:3091-3099`, but every non-validation mid-run failure rolls back at `NEW_CONFIG.md:3127-3135`. Lifecycle execution is still part of step 5, so both rules apply.  
    **Fix:** define commit immediately after successful conversion/deletion, before deferred lifecycle execution.

11. **Shared fixed-port behavior is undefined on macOS and Windows.**  
    `NEW_CONFIG.md:966-1007` says shared fixed ports need `SO_REUSEPORT`, known unavailable there, but delegates behavior to another issue. This must be part of the public configuration contract.  
    **Fix:** reject `workers > 1` plus shared fixed port on unsupported platforms and direct users to `perWorkerIncrement`.

12. **A public config API is missing from the DTO decision.**  
    The proposal covers `getRuntimeConfig()` and `getApplicationDetails()`, but not `runtime.getApplicationConfig()`, which remains a distinct transformed worker-side API at `packages/runtime/lib/runtime.js:2178-2182`. Specify whether it survives and whether it returns raw, patched, or transformed configuration.

## Verdict

I would not approve implementation yet. The core model is promising, but evaluation ordering, topology/resolve semantics, and migration fidelity currently contain executable contradictions rather than documentation-polish issues.
