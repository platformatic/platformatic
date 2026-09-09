import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

/*
  gateway's applications option is a capability option that happens to share a root key's name.
  Classification rule 2 is unconditional precisely so that a definition carrying it is still read
  as an application definition rather than as a root configuration.
*/
export const gateway = defineCapabilityFactory('@platformatic/gateway', schema, {
  version,
  flatten: ['gateway']
})
