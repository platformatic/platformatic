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

  Each entry here is a position somebody read the consumers of before adding it. The audit
  (`scripts/audit-schemas.mjs`) produces the candidates and flags the ones whose string form is
  parsed somewhere; it cannot produce this list, because it keys its evidence on the property name
  and two properties sharing a name can answer differently -- an application entry's `enabled` reads
  a string and `telemetry.enabled` beside it does not.

  `port`: 48 sites across the shipped schemas, every one placeholder-shaped, and nothing anywhere
  reads a string port. `Number(process.env.PORT || 3042)` is what the documentation and migrate
  both emit.
*/
const PLACEHOLDER_BRANCHES = [['server', 'port']]

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

function projectPlaceholderBranches (schema) {
  let projected = schema

  for (const path of PLACEHOLDER_BRANCHES) {
    let node = projected
    const parents = []

    for (const key of path) {
      const next = node?.properties?.[key]

      if (!next) {
        break
      }

      parents.push([node, key])
      node = next
    }

    if (parents.length !== path.length) {
      continue
    }

    const replacement = withoutPlaceholderBranch(node)

    if (replacement === node) {
      continue
    }

    // Rebuilt from the leaf up, copying only the objects on the path.
    let rebuilt = replacement

    for (const [parent, key] of parents.reverse()) {
      rebuilt = { ...parent, properties: { ...parent.properties, [key]: rebuilt } }
    }

    projected = rebuilt
  }

  return projected
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
