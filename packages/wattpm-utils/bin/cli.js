#!/usr/bin/env node

import { checkNodeVersionForServices, setExecutableId, setExecutableName } from '@platformatic/foundation'

checkNodeVersionForServices()
setExecutableId(process.env.WATTPM_EXECUTABLE_ID ?? 'wattpm-utils')
setExecutableName(process.env.WATTPM_EXECUTABLE_NAME ?? 'Watt Utils')

// Use await import here so that we can throw a proper error on unsupported Node.js version
const { main } = await import('../index.js')
await main()
