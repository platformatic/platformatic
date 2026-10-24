import { defineCapabilityFactory } from '@platformatic/basic'
import { schema, version } from './schema.js'

export const createViteConfig = defineCapabilityFactory('@platformatic/vite', schema, {
  version,
  flatten: ['vite']
})
