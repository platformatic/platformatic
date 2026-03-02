#!/usr/bin/env node

import { checkNodeVersionForApplications } from '@platformatic/foundation'
import { createCLIContext } from '@platformatic/foundation/lib/cli.js'

checkNodeVersionForApplications()

// Use await import here so that we can throw a proper error on unsupported Node.js version
const { main } = await import('../index.js')
await main.call(createCLIContext('wattpm-utils', 'Watt'))
