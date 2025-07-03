#!/usr/bin/env node

import { checkNodeVersionForServices } from '@platformatic/utils'
import { main, setExecutableParameters } from 'wattpm'

setExecutableParameters('plt', 'Platformatic')
checkNodeVersionForServices()
await main()
