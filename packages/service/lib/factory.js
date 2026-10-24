import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const createServiceConfig = defineCapabilityFactory('@platformatic/service', schema, {
  version,
  flatten: ['service']
})
