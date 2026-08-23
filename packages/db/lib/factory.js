import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

/*
  db's block carries a cache property while next's schema has a top-level cache object, so
  flattening it would give one authored key two structurally different meanings across
  capabilities. That is a decision for the schema audit — rename, keep nested, or exclude — and
  until it is recorded the key stays nested, where it is unambiguous.
*/
export const db = defineCapabilityFactory('@platformatic/db', schema, {
  version,
  flatten: ['db'],
  exclude: ['cache']
})
