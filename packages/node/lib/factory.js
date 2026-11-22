import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const createNodeConfig = defineCapabilityFactory('@platformatic/node', schema, {
  version,
  flatten: ['node']
})
