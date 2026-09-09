import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const next = defineCapabilityFactory('@platformatic/next', schema, {
  version,
  flatten: ['next']
})
