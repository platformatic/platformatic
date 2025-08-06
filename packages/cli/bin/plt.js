#!/usr/bin/env node

import { checkNodeVersionForServices } from '@platformatic/foundation'
import { main, setExecutableParameters } from 'wattpm'

setExecutableParameters('plt', 'Platformatic')
checkNodeVersionForServices()
await main()
