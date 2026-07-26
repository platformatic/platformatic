# Platformatic Documentation Restructuring Plan

## Following the Diátaxis Framework

**Last audited: 2026-07-26** (previous revision: 2025-09-11)

---

## Audit Summary — Read This First

The previous revision of this plan claimed Phase 3 was "❌ NOT STARTED". **That is wrong.** Phase 3
content was written and merged in PR #4275 (`doc: Phase3 strategic content`), and the plan was never
updated. The real problem today is not missing content — it is **content that exists but is
unreachable**.

### The headline finding: `docs/overview/` is orphaned

All five planned overview pages exist on disk:

| File | Lines | In sidebar? |
| --- | --- | --- |
| `docs/overview/what-is-watt.md` | 386 | ❌ No |
| `docs/overview/getting-started.md` | 277 | ❌ No |
| `docs/overview/architecture-overview.md` | 566 | ❌ No |
| `docs/overview/use-cases-and-examples.md` | 430 | ❌ No |
| `docs/overview/comparison-with-alternatives.md` | 811 | ❌ No |

`docs/sidebars.js` still exposes only the single legacy page `docs/Overview.md` (104 lines) under the
"Overview" category. Roughly **2,470 lines of strategic content are invisible on the published site.**

Worse, those pages link to routes that do not exist, so even if they were wired up today they would
ship broken navigation:

- `/docs/getting-started/quick-start-watt` → the file is `getting-started/quick-start.md`
- `/docs/reference/watt/` → the real path is `reference/wattpm/`
- `/docs/guides/databases/`, `/docs/guides/frameworks/`, `/docs/guides/integrations/`,
  `/docs/guides/monitoring/`, `/docs/guides/deployment/` → no such index pages exist

**Wiring up and repairing `docs/overview/` is the single highest-value documentation task available.**
It converts already-paid-for work into user-visible value.

### Full orphan list (on disk, absent from `docs/sidebars.js`)

Docs are published to the separate `platformatic/docs` repo via `.github/workflows/update-docs.yml`,
so `docs/sidebars.js` is the **single source of truth for navigation**. A page absent from it is
effectively unpublished.

| Orphan | Disposition |
| --- | --- |
| `overview/what-is-watt` | Wire up (see above) |
| `overview/getting-started` | Wire up — but resolve overlap with `getting-started/quick-start` first |
| `overview/architecture-overview` | Wire up |
| `overview/use-cases-and-examples` | Wire up |
| `overview/comparison-with-alternatives` | Wire up |
| `guides/logging` | Wire up — Phase 2 explicitly enhanced this file, then never linked it |
| `guides/capabilities` | Wire up under How-to Guides (linked from `guides.md` index only) |
| `guides/frameworks` | Wire up under How-to Guides (linked from `guides.md` index only) |
| `guides/cli-managing` | Wire up under How-to Guides (linked from `guides.md` index only) |
| `guides/opentelemetry-sdk-setup` | Wire up under Monitoring & Observability |
| `reference/wattpm/reference` | Merge into `reference/wattpm/cli-commands` (overlapping content) or wire up |
| `getting-started/issues` | Intentional — MDX partial, imported via `import Issues from ...`. Leave out. |
| `getting-started/new-api-project-instructions` | Verify whether still used as a partial; delete if dead. |

Note: `docs/guides.md` (the How-to Guides index page) *does* link several of these, so they are
reachable by clicking through, but they never appear in the sidebar tree.

### Terminology and product drift the plan had not absorbed

1. **Composer → Gateway.** `packages/gateway` now exists and docs live at `docs/reference/gateway/`.
   The old plan referred to "Composer Service" throughout. Both `packages/composer` and
   `packages/gateway` are present in the workspace, so docs must be explicit about which is current.
2. **Services → Applications.** Runtime docs now consistently say "applications" for the units running
   inside Watt (`reference/runtime/overview.md`). The old plan's "services that run within Watt"
   phrasing is off-message.
3. **Capability set has more than doubled.** The plan's reference tree listed only `next`, `astro`,
   `node`. Shipped today: `astro`, `nest`, `next`, `nitro`, `node`, `nuxt`, `react-router`, `remix`,
   `tanstack`, `vite`.

### Items from the previous plan that are now obsolete

- **"Split the Monitoring and Observability guide"** — moot. `docs/guides/monitoring-and-observability.md`
  was deleted, and `docs/guides/monitoring.md` was renamed to `docs/guides/metrics.md`. Observability
  is now covered by a set of focused guides (`metrics`, `distributed-tracing`, `logging`,
  `logging-to-elasticsearch`, `opentelemetry-logging`, `opentelemetry-sdk-setup`,
  `profiling-with-watt`, `heap-snapshots`, `capture-flamegraphs-on-health-events`,
  `debugging-with-repl`). **Drop this requirement.**
- **"Multiple competing getting-started paths"** — partially resolved.
  `docs/getting-started/quick-start-guide.md` was deleted. One overlap remains (below).
- **"Move `docs/packages/` to `docs/reference/`"** — done.
- **"Team Structure Suggestions" (Tutorial Specialist / Technical Writer / …)** — never actionable for
  this repo. **Dropped.**

### Remaining structural problems

1. **Two competing "getting started" entry points.** `docs/getting-started/quick-start.md` (327 lines,
   hands-on: Node app → Gateway → Next.js → build/debug) vs `docs/overview/getting-started.md` (277
   lines, a path-chooser with decision tree and success criteria). These serve different Diátaxis
   purposes and both are useful — but they need explicit cross-linking and distinct titles, or users
   will land on the wrong one.
2. **The Explanation quadrant does not exist.** There is no `docs/concepts/`. Explanation-type content
   is scattered across `guides/watt-architecture-patterns.md`,
   `reference/runtime/multithread-architecture.md`, and `overview/architecture-overview.md` —
   i.e. filed under How-to and Reference, violating Diátaxis separation.
3. **`docs/learn/` never grew.** It still contains exactly two beginner tutorials
   (`crud-application`, `environment-variables`). The planned `quick-start/`, `tutorials/`,
   `examples/`, and `migrations/` subtrees do not exist. Every migration guide the plan called for
   (Express, Fastify, monolith) is still missing — while `getting-started/port-your-app.md` covers
   some of that ground and should be the seed for it.
4. **`docs/Overview.md` vs `docs/overview/what-is-watt.md`** are near-duplicates in intent. Pick one
   as the canonical landing page.
5. **TypeScript compilation guide split** — never done; `docs/guides/deployment/compiling-typescript.md`
   remains a single file. Re-evaluate whether the split is still worth it (see Phase 6).

---

## Revised Roadmap

Phases 1 and 2 are complete and are archived at the bottom of this document. Phase 3 is complete on
disk but undelivered to users. The work below is ordered by value per unit of effort.

### Phase 4: Deliver What Already Exists 🔴 CRITICAL — DO THIS FIRST

**Effort: low. Value: very high.** No new prose required; this is wiring and link repair.

- [ ] **Repair links in `docs/overview/*.md`**
  - [ ] `/docs/getting-started/quick-start-watt` → `/docs/getting-started/quick-start`
  - [ ] `/docs/reference/watt/` → `/docs/reference/wattpm/overview`
  - [ ] Replace the five nonexistent `/docs/guides/<topic>/` directory links with links to real
        guides, or to the `docs/guides.md` index
  - [ ] Run the Docusaurus build to confirm zero broken-link warnings (this is how PR #4867 caught
        the previous round)
- [ ] **Add `docs/overview/` to `docs/sidebars.js`**
  - [ ] Expand the "Overview" category to: `Overview` (landing), `overview/what-is-watt`,
        `overview/architecture-overview`, `overview/use-cases-and-examples`,
        `overview/comparison-with-alternatives`
  - [ ] Place `overview/getting-started` at the top of the "Getting Started" category as the path
        chooser, above `getting-started/quick-start`
  - [ ] Keep `collapsed: false` on Overview and Getting Started
- [ ] **Wire up the orphaned guides**
  - [ ] `guides/logging` → Monitoring & Observability
  - [ ] `guides/opentelemetry-sdk-setup` → Monitoring & Observability
  - [ ] `guides/capabilities`, `guides/frameworks` → Application Development
  - [ ] `guides/cli-managing` → Deployment & Operations (or Application Development)
- [ ] **Resolve `reference/wattpm/reference` vs `reference/wattpm/cli-commands`** — merge or wire up;
      do not ship two overlapping CLI references
- [ ] **Decide `docs/Overview.md` vs `docs/overview/what-is-watt.md`** — keep one canonical page,
      redirect or trim the other
- [ ] **Confirm `getting-started/new-api-project-instructions.md` is still imported as a partial**;
      delete if dead

**Exit criteria:** every non-partial `.md` under `docs/` appears in `docs/sidebars.js`, and the
Docusaurus build emits no broken-link warnings.

### Phase 5: Terminology and Accuracy Pass 🟡 HIGH

**Effort: medium. Value: high.** Users currently hit contradictory names for the same thing.

- [ ] **Composer → Gateway.** Audit the 8 docs files still saying "composer". Establish and apply one
      rule: Gateway is the product name; mention Composer only where naming history matters for
      migration.
- [ ] **Services → Applications.** Align `docs/Overview.md`, `docs/overview/*.md`, and the sidebar
      with the runtime docs' "applications" terminology.
- [ ] **Complete the capability coverage.** Overview and architecture pages should reflect all ten
      shipped capabilities, not the original three.
- [ ] **Verify tutorials still run end-to-end.** `learn/beginner/crud-application.md` and
      `getting-started/quick-start.md` have both drifted through many releases since their last
      verification.

### Phase 6: Fill the Diátaxis Gaps 🟢 MEDIUM

**Effort: high. Value: medium — do not start before Phases 4 and 5.**

- [ ] **Create `docs/concepts/`** (the missing Explanation quadrant) and relocate/derive:
  - [ ] `concepts/watt-architecture.md` — seed from `overview/architecture-overview.md` and
        `guides/watt-architecture-patterns.md`
  - [ ] `concepts/multithread-model.md` — seed from `reference/runtime/multithread-architecture.md`
  - [ ] `concepts/application-lifecycle.md`
  - [ ] `concepts/modular-monolith.md` — the positioning the README already leads with
- [ ] **Grow `docs/learn/`**
  - [ ] `learn/migrations/from-express.md`, `from-fastify.md` — seed from
        `getting-started/port-your-app.md`
  - [ ] Example gallery, if and only if the examples are CI-tested; an untested example gallery is a
        net negative
- [ ] **Re-evaluate the TypeScript guide split.** The original rationale (separating plain Node.js
      compilation from `plt service compile` / `plt runtime compile`) may no longer hold given
      current tooling. Confirm the commands still exist before splitting.

### Explicitly Not Doing

- Splitting the monitoring/observability guide — the file no longer exists.
- The success-metrics dashboard (bounce rates, completion rates, analytics tracking) from the
  original plan. This repo has no analytics pipeline; these were aspirational and unmeasurable.
- Assigning named documentation roles.

---

## Target Structure (Revised)

Reflects current package names and shipped capabilities.

```
docs/
├── Overview.md                        # Canonical landing page
├── overview/                          # Discovery & orientation  [EXISTS, ORPHANED]
│   ├── what-is-watt.md
│   ├── getting-started.md             # Path chooser
│   ├── architecture-overview.md
│   ├── use-cases-and-examples.md
│   └── comparison-with-alternatives.md
├── getting-started/                   # Hands-on entry
│   ├── quick-start.md
│   └── port-your-app.md
├── learn/                             # Tutorials  [THIN — 2 files]
│   ├── beginner/
│   └── migrations/                    # [MISSING]
├── guides/                            # How-to  [HEALTHY]
│   ├── deployment/
│   └── ...
├── reference/                         # Information-oriented  [HEALTHY]
│   ├── wattpm/                        # Watt — primary product
│   ├── runtime/
│   ├── service/  gateway/  db/        # Applications
│   ├── astro/ nest/ next/ nitro/ node/ nuxt/
│   │   react-router/ remix/ tanstack/ vite/   # Capabilities
│   └── sql-mapper/ sql-graphql/ sql-openapi/ sql-events/
└── concepts/                          # Explanation  [MISSING ENTIRELY]
```

---

## Strategic Foundation (Unchanged — Still Valid)

The positioning and user-journey analysis below has held up well and continues to guide content
decisions. It is retained verbatim in intent from the original plan.

### Strategic Focus

**Watt (wattpm) is the primary product** — the Node.js Application Server that powers everything else.
Other components (DB, Service, Gateway, Runtime) are applications and features that run within Watt.

### User Types and Entry Points

**1. New Node.js Developers**

- **Entry Point**: Landing page → "What is Watt?" → Quick Start Tutorial
- **Success Criteria**: Can build and deploy a simple API within 30 minutes
- **Journey**: Overview → Tutorial → How-to Guides → Reference

**2. Experienced Node.js Developers**

- **Entry Point**: README → Architecture Overview → Migration Guide
- **Success Criteria**: Can migrate an existing project or build a complex app within 2 hours
- **Journey**: Overview → Comparison → How-to Guides → Reference → Concepts

**3. Teams Migrating from Other Platforms**

- **Entry Point**: Landing page → "Why Watt?" → Architecture Comparison
- **Success Criteria**: Team can evaluate and pilot Watt for production use
- **Journey**: Overview → Concepts → Migration Guides → Advanced How-tos

**4. Platform/DevOps Engineers**

- **Entry Point**: Documentation → Deployment Guides → Monitoring Setup
- **Success Criteria**: Can deploy and monitor Watt applications in production
- **Journey**: Architecture Overview → Deployment How-tos → Advanced Configuration

### Critical Decision Points

| Stage | Question | Content required | Status |
| --- | --- | --- | --- |
| Discovery | "Should I use Watt?" | Value prop, comparison matrix | ✅ Written, ❌ orphaned |
| Evaluation | "How do I get started?" | Multi-path entry, time estimates | ✅ Written, ❌ orphaned |
| Implementation | "Can this work for my project?" | Integration guides, compatibility | ✅ Largely covered |
| Adoption | "How do I use this in production?" | Deployment, monitoring, scaling | ✅ Strong coverage |

The pattern is clear: **discovery and evaluation content exists but is unreachable, while
implementation and adoption content is well served.** Phase 4 closes exactly this gap.

### Multi-Path Entry Strategy

**Path 1: Quick Start (5–10 min)** — immediate results via `npx wattpm create`, running app with
endpoints, then pointed at a full tutorial or integration guide.

**Path 2: Guided Tutorial (30 min)** — step-by-step learning producing both conceptual understanding
and a working application.

**Path 3: Example-Driven (15–20 min)** — a gallery of complete, runnable examples for developers who
learn from working reference implementations.

**Path 4: Migration-Focused (45–60 min)** — for teams with existing Express/Fastify/monolith
applications.

Paths 1, 2, and 4 have real content today (`getting-started/quick-start.md`,
`learn/beginner/crud-application.md`, `getting-started/port-your-app.md`). Path 3 does not.

### Content Creation Guidelines

1. **Tutorials must work reliably** — test every step against the current release
2. **How-to guides solve real problems** — derived from actual user questions
3. **Reference is accurate and current** — auto-generated where possible
4. **Explanations provide context** — why, not just what
5. **Nothing ships unlinked** — if it is not in `docs/sidebars.js`, it does not exist

Guideline 5 is new, and is the direct lesson of the Phase 3 regression.

---

## Archive: Completed Phases

### Phase 1: Foundation ✅ COMPLETED

- [x] Root README rewritten with Watt-first positioning and clear entry paths
- [x] `docs/sidebars.js` reorganized from package-centric to user-journey-centric
- [x] `docs/packages/` moved to `docs/reference/`, grouped by user mental model
- [x] Getting-started content consolidated; `quick-start-guide.md` removed

### Phase 2: Content Enhancement ✅ COMPLETED (December 2024, PR #4183)

- [x] CRUD tutorial restructured to Watt-first positioning with learning objectives and time estimates
- [x] Environment-variables tutorial rewritten to Diátaxis tutorial principles
- [x] Deployment guides enhanced with problem–solution structure
      (`dockerize-a-watt-app`, `compiling-typescript`, `k8s-readiness-liveness`)
- [x] Watt guides enhanced (`cache-with-platformatic-watt`, `use-watt-multiple-repository`,
      `using-watt-with-node-config`)
- [x] `docs/guides/logging.md` reorganized by use case — *note: still not in the sidebar, see Phase 4*
- [x] `docs/reference/wattpm/cli-commands.md` created, unifying wattpm and platformatic commands
- [x] `docs/reference/troubleshooting.md` created
- [x] Service overviews repositioned as components within Watt

### Phase 3: Strategic New Content ✅ COMPLETED ON DISK (PR #4275) / ❌ NOT DELIVERED

All five `docs/overview/` pages were authored and merged. **They were never added to
`docs/sidebars.js` and their internal links were never validated**, so no user has seen them.
Phase 4 exists to finish the delivery.

---

_This plan positions Platformatic around Watt as the core Node.js Application Server, following the
Diátaxis framework. As of the 2026-07-26 audit, the binding constraint is not content creation but
content delivery: the highest-value work is making existing, already-written documentation reachable._
