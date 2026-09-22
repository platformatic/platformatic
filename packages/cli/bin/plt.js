#!/usr/bin/env node

import { enableCompileCache } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

enableCompileCache(join(homedir(), '.cache', 'platformatic', 'compile-cache'))

// Load via dynamic import so all modules benefit from compile cache
const { checkNodeVersionForApplications, createCLIContext } = await import('@platformatic/foundation')
const { main } = await import('wattpm')

checkNodeVersionForApplications()
await main.call(createCLIContext('plt', 'Platformatic'))
