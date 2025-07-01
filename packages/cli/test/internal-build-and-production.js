import { safeRemove } from '@platformatic/utils'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  verifyBuildAndProductionMode,
  verifyPlatformaticComposer,
  verifyPlatformaticDB,
  verifyPlatformaticService
} from './helper.js'

verifyBuildAndProductionMode(fileURLToPath(new URL('fixtures/internal-build-and-production', import.meta.url)), [
  {
    id: 'main',
    name: '@platformatic/db and @platformatic/service (in composer)',
    files: [
      'services/composer/dist/plugins/example.js',
      'services/composer/dist/routes/root.js',
      'services/db/dist/plugins/example.js',
      'services/db/dist/routes/root.js',
      'services/service/dist/plugins/example.js',
      'services/service/dist/routes/root.js'
    ],
    checks: [verifyPlatformaticComposer, verifyPlatformaticDB, verifyPlatformaticService]
  }
])

test.after(async () => {
  await safeRemove(new URL('../types', import.meta.url))
  await safeRemove(new URL('../plt-env.d.ts', import.meta.url))
  await safeRemove(new URL('../schema.lock', import.meta.url))
})
