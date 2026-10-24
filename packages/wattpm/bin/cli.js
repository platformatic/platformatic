#!/usr/bin/env node

import { enableCompileCache } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

enableCompileCache(join(homedir(), '.cache', 'platformatic', 'compile-cache'))

// Load wattpm via dynamic import so all modules benefit from compile cache
const { checkNodeVersionForApplications, createCLIContext } = await import('@platformatic/foundation')

checkNodeVersionForApplications()

const { main } = await import('../index.js')
await main.call(createCLIContext('wattpm', 'Watt'))
