import { registerCloseCallback } from '@platformatic/globals'
import { preview } from 'astro'

// Preview does not run the development server hook that registers cleanup.
const server = await preview({})
registerCloseCallback(() => server.stop())
