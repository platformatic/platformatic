import { getIsBuilding } from '@platformatic/globals'
console.log(`INJECTED ${getIsBuilding({ throwOnMissing: false }) ?? false}`)
