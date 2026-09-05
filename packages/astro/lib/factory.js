import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const astro = defineCapabilityFactory('@platformatic/astro', schema, {
  version,
  flatten: ['astro']
})
