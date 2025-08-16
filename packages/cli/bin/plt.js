#!/usr/bin/env node

import { checkNodeVersionForServices, setExecutableId, setExecutableName } from '@platformatic/foundation'
import { main } from 'wattpm'

setExecutableId('plt')
setExecutableName('Platformatic')
checkNodeVersionForServices()
await main()
