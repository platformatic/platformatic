#!/usr/bin/env node

import { checkNodeVersionForServices } from '@platformatic/utils'

checkNodeVersionForServices()

// Use await import here so that we can throw a proprer error on unsupported Node.js version
const { main } = await import('../index.js')
await main()
