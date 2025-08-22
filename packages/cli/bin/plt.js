#!/usr/bin/env node

import { checkNodeVersionForApplications, setExecutableId, setExecutableName } from '@platformatic/foundation'
import { main } from 'wattpm'

setExecutableId('plt')
setExecutableName('Platformatic')
checkNodeVersionForApplications()
await main()
