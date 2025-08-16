#!/usr/bin/env node

import { checkNodeVersionForServices, setExecutableId, setExecutableName } from '@platformatic/foundation'

checkNodeVersionForServices()
setExecutableId('wattpm-utils')
setExecutableName('Watt Utils')

// Use await import here so that we can throw a proper error on unsupported Node.js version
const { main } = await import('../index.js')
await main()
