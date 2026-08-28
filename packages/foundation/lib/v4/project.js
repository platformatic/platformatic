/*
  The v4 view of a capability's schema.

  A capability ships one schema and it validates both dialects, because the v3 loader still reads
  v3 configurations with it. So v4's narrowing is applied as a **projection** over that object
  rather than an edit to it: this returns a copy with what v4 does not implement removed, and the
  original keeps validating v3 exactly as before. When v3 loading goes, the projection becomes the
  schema and this file goes with it.

  It is applied where the v4 loader obtains a schema, which is the one place that only v4 reaches.
*/

/*
  The runtime's own schema drops these in `v4Schema`. A capability embeds the same properties under
  its `runtime` key and dropped nothing, so `strictEnv` was refused at the root of a project and
  accepted a few lines further down in the same configuration -- the worst of both, since the key
  validated and then did nothing.

  `$schema` is not in this list: a machine writer of the plain-object form stamps it, and the loader
  strips it before validation rather than refusing it (see "Machine-generated configs").
*/
const REMOVED_FROM_RUNTIME_BLOCK = ['envfile', 'strictEnv']

function isPlainObject (value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/*
  The placeholder branches, classified one at a time.

  v3's `{PLT_X}` was a string, so almost every typed property grew a bare string branch beside its
  real type to admit one. v4 has no placeholders, and since the worker stopped re-validating a
  resolved configuration there is no coercion left to turn a string back into what the property
  wanted -- so a surviving branch does not merely admit a dead spelling, it admits a value that
  reaches the capability as the wrong type.

  Each entry is a position whose consumers somebody read. The audit
  (`scripts/audit-schemas.mjs`) produces the candidates and flags the ones whose string form is
  parsed somewhere; it cannot produce this list, because it keys its evidence on the property name
  and two properties sharing a name can answer differently -- an application entry's `enabled` reads
  a string and `telemetry.enabled` beside it does not.

  Positions are named `parent/property` rather than by name alone, for that reason, and matched
  wherever the schema embeds them: the same health block appears at the root, under `runtime`, and
  under every application entry.

  What is deliberately *not* here, besides the two `enabled` positions above: `https/key` and
  `https/cert`, whose string is the PEM itself (`sanitizeHTTPSArgument` returns a string argument
  untouched, and the object form beside it is the file alternative); and `workers`, which
  `coercePositiveInteger` parses from a string on the v4 path, raising a named error when it will
  not convert.

  Nor is the rest of the health block. `maxHeapTotal`,
  `maxYoungGeneration`, `codeRangeSize`, `bufferPoolSize` and `defaultHighWaterMark` are each passed
  to `parseMemorySize`, so `'1 GB'` is a value they mean rather than a placeholder they tolerate.
  `maxHeapUsed` sits among them and is not one of them: it is a ratio with `maximum: 1` and a
  default of `0.99`, compared numerically and printed as a percentage, and nothing parses it. Its
  own schema says so -- a memory size could never have satisfied `maximum: 1`.
*/
const PLACEHOLDER_BRANCHES = new Set([
  // A port is a number. Forty-eight sites, and nothing anywhere reads a string one.
  'server/port',
  /*
    Five properties called `enabled`, four answers, and only their consumers separate them.

    Removed here: these are read as booleans and nothing else -- `!== false` for `health`,
    `telemetry` and `watch`, `=== false` for a scheduler job, `=== true` for `deduplication`.
    A string never reached any of those comparisons as anything but a surprise: `'false'` is not
    `false`, so a v3 configuration that wrote one had a setting that validated and did nothing.

    Worse for Next's two, which test truthiness -- `if (httpsOptions.enabled)`. There `'false'`
    turns HTTPS *on*.

    Kept, and not on this list: an application entry's `enabled`, which `isApplicationEnabled`
    reads as "anything but 'false' is true", and `otlpExporter.enabled`, where
    `packages/metrics/index.js` compares against the string `'false'` by name.
  */
  'health/enabled',
  'telemetry/enabled',
  'watch/enabled',
  'scheduler/enabled',
  'deduplication/enabled',
  'https/enabled',
  'cache/enabled',
  /*
    Numbers, at the root of a runtime configuration and under the `runtime` block a capability
    embeds -- the same properties, reachable by two paths, so both are named.

    `applicationTimeout` and `messagingTimeout` are passed straight to a timeout,
    `workersRestartDelay` is compared and slept on, `startupConcurrency` goes through `Math.max`,
    and both halves of `gracefulShutdown` are milliseconds. None is parsed from a string.
  */
  '(root)/applicationTimeout',
  'runtime/applicationTimeout',
  '(root)/messagingTimeout',
  'runtime/messagingTimeout',
  '(root)/workersRestartDelay',
  'runtime/workersRestartDelay',
  '(root)/startupConcurrency',
  'runtime/startupConcurrency',
  'gracefulShutdown/runtime',
  'gracefulShutdown/application',
  /*
    Metrics and probes. `metrics.enabled` and `healthProbes.enabled` are `!== false`,
    `telemetry.diagLogger` is `!== true`, and the ports and timeouts are numbers.

    `metrics.httpClientMetrics` is *not* here: `packages/metrics/index.js` compares it against the
    string `'true'` by name, like `otlpExporter.enabled` beside it.
  */
  'metrics/enabled',
  'metrics/port',
  'metrics/timeout',
  'metrics/healthChecksTimeouts',
  'healthProbes/enabled',
  'healthProbes/port',
  'telemetry/diagLogger',
  // Milliseconds, counts and ratios. Each is compared or arithmetic'd, never parsed.
  'health/interval',
  'health/gracePeriod',
  'health/maxUnhealthyChecks',
  'health/maxELU',
  'health/maxEventLoopDelay',
  'health/maxEventLoopDelayP99',
  'health/maxHeapUsed'
])

/*
  A bare string branch: `{ type: 'string' }` and nothing else. One that enumerates values, bounds a
  length or names a pattern is describing something real, and is not what this removes.
*/
function isBareString (branch) {
  return branch?.type === 'string' && Object.keys(branch).every(key => key === 'type' || key === 'description')
}

function withoutPlaceholderBranch (property) {
  for (const keyword of ['anyOf', 'oneOf']) {
    const branches = property?.[keyword]

    if (!Array.isArray(branches) || branches.length < 2) {
      continue
    }

    const kept = branches.filter(branch => !isBareString(branch))

    if (kept.length > 0 && kept.length < branches.length) {
      const { [keyword]: _removed, ...rest } = property

      /*
        One branch left is not a union any more. Keeping a single-member `anyOf` would validate the
        same and read worse, and it leaves the keyword present for anything that inspects the schema
        -- the generated types among them.
      */
      return kept.length === 1 ? { ...rest, ...kept[0] } : { ...rest, [keyword]: kept }
    }
  }

  return property
}

/*
  Returns the same object when nothing below it changed, so a schema with no placeholder branch to
  remove is not rebuilt -- every capability embeds the shared blocks, and this runs per load.
*/
function projectPlaceholderBranches (node, parent = '(root)', name = null) {
  if (Array.isArray(node)) {
    let changed = false
    const mapped = node.map(entry => {
      const next = projectPlaceholderBranches(entry, parent, name)
      changed ||= next !== entry
      return next
    })

    return changed ? mapped : node
  }

  if (node === null || typeof node !== 'object') {
    return node
  }

  let result = node

  if (parent && name && PLACEHOLDER_BRANCHES.has(`${parent}/${name}`)) {
    result = withoutPlaceholderBranch(node)
  }

  let changed = result !== node
  const mapped = { ...result }

  for (const [key, value] of Object.entries(result)) {
    /*
      `properties` and `$defs` are maps whose keys are property names rather than schema keywords,
      so descending into them is what advances the `parent/property` path. Everywhere else the path
      is carried through unchanged -- an `anyOf` branch of `server` is still `server`.
    */
    if (key === 'properties' || key === '$defs' || key === 'definitions') {
      let innerChanged = false
      const inner = {}

      for (const [property, schema] of Object.entries(value ?? {})) {
        inner[property] = projectPlaceholderBranches(schema, name ?? parent, property)
        innerChanged ||= inner[property] !== schema
      }

      if (innerChanged) {
        mapped[key] = inner
        changed = true
      }

      continue
    }

    const next = projectPlaceholderBranches(value, parent, name)

    if (next !== value) {
      mapped[key] = next
      changed = true
    }
  }

  return changed ? mapped : result
}

export function projectRuntimeBlock (block) {
  if (!isPlainObject(block?.properties)) {
    return block
  }

  const properties = { ...block.properties }
  let removed = false

  for (const key of REMOVED_FROM_RUNTIME_BLOCK) {
    if (key in properties) {
      delete properties[key]
      removed = true
    }
  }

  return removed ? { ...block, properties } : block
}

/*
  Copied only along the path that changes. A schema is large and every capability embeds the shared
  blocks, so rebuilding all of it to remove two keys would allocate a second copy of the whole thing
  per load for no benefit.
*/
export function projectCapabilitySchema (schema) {
  const runtimeBlock = schema?.properties?.runtime

  if (!runtimeBlock) {
    return projectPlaceholderBranches(schema)
  }

  const projected = projectRuntimeBlock(runtimeBlock)

  const withRuntime =
    projected === runtimeBlock ? schema : { ...schema, properties: { ...schema.properties, runtime: projected } }

  return projectPlaceholderBranches(withRuntime)
}
