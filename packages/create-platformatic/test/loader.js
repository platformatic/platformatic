import { Hook } from 'import-in-the-middle'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

register('import-in-the-middle/hook.mjs', import.meta.url)

// The package name will not work as we are in a pnpm workspace
// eslint-disable-next-line no-new
new Hook([fileURLToPath(new URL('../../create-wattpm/lib/index.js', import.meta.url))], function (exported) {
  exported.createPlatformatic = async function () {
    console.log('OK')
  }
})
