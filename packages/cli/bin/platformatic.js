#!/usr/bin/env node

// Enable compile cache before loading any modules (Node.js 22.1.0+)
import { homedir } from 'node:os'
import { join } from 'node:path'

try {
  const { enableCompileCache } = await import('node:module')
  if (typeof enableCompileCache === 'function') {
    enableCompileCache(join(homedir(), '.cache', 'platformatic', 'compile-cache'))
  }
} catch {
  // Compile cache not available, continue without it
}

// Load via dynamic import so all modules benefit from compile cache
const { checkNodeVersionForApplications, setExecutableId, setExecutableName } = await import('@platformatic/foundation')
const { main } = await import('wattpm')

setExecutableId('platformatic')
setExecutableName('Platformatic')
checkNodeVersionForApplications()
await main()
