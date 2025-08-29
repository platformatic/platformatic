#!/usr/bin/env node

import { checkNodeVersionForApplications, setExecutableId, setExecutableName } from '@platformatic/foundation'

checkNodeVersionForApplications()
setExecutableId('wattpm')
setExecutableName('Watt')

// Use await import here so that we can throw a proper error on unsupported Node.js version
const { main } = await import('../index.js')
await main()
