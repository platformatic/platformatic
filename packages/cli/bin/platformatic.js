#!/usr/bin/env node

import { checkNodeVersionForServices } from '@platformatic/utils'
import { main, setExecutableParameters } from 'wattpm'

setExecutableParameters('platformatic', 'Platformatic')
checkNodeVersionForServices()
await main()
