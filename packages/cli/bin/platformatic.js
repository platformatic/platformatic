#!/usr/bin/env node

import { checkNodeVersionForServices } from '@platformatic/foundation'
import { main, setExecutableParameters } from 'wattpm'

setExecutableParameters('platformatic', 'Platformatic')
checkNodeVersionForServices()
await main()
