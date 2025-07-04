#!/usr/bin/env node

import { checkNodeVersionForServices } from '@platformatic/utils'

checkNodeVersionForServices()

// Use await import here so that we can throw a proper error on unsupported Node.js version
const { main } = await import('../index.js')
await main()
