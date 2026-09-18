import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const createNextConfig = defineCapabilityFactory('@platformatic/next', schema, {
  version,
  flatten: ['next']
})
