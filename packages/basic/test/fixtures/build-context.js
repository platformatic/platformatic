import { isBuilding } from '@platformatic/globals'
console.log(`INJECTED ${isBuilding({ throwOnMissing: false }) ?? false}`)
