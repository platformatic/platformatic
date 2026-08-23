import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const service = defineCapabilityFactory('@platformatic/service', schema, {
  version,
  flatten: ['service']
})
