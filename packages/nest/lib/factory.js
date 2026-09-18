import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const createNestConfig = defineCapabilityFactory('@platformatic/nest', schema, {
  version,
  flatten: ['nest']
})
