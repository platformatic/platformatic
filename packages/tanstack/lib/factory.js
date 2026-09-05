import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

/*
  Vite-derived capabilities flatten the vite block alongside their own; outputDirectory comes
  from the capability's block while application.outputDirectory stays nested, which is why the
  application block is not flattened anywhere.
*/
export const tanstack = defineCapabilityFactory('@platformatic/tanstack', schema, {
  version,
  flatten: ['vite']
})
