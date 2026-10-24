import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const createAstroConfig = defineCapabilityFactory('@platformatic/astro', schema, {
  version,
  flatten: ['astro']
})
