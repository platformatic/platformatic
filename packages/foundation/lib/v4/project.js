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
    return schema
  }

  const projected = projectRuntimeBlock(runtimeBlock)

  if (projected === runtimeBlock) {
    return schema
  }

  return { ...schema, properties: { ...schema.properties, runtime: projected } }
}
