#!/usr/bin/env node

import { checkNodeVersionForApplications, setExecutableId, setExecutableName } from '@platformatic/foundation'
import { main } from 'wattpm'

setExecutableId('platformatic')
setExecutableName('Platformatic')
checkNodeVersionForApplications()
await main()
