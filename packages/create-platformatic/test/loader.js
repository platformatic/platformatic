import { Hook } from 'import-in-the-middle'
import { register } from 'node:module'

register('import-in-the-middle/hook.mjs', import.meta.url)

// The package name will not work as we are in a pnpm workspace
// eslint-disable-next-line no-new
new Hook([new URL('../../create-wattpm/lib/index.js', import.meta.url).pathname], function (exported) {
  exported.createPlatformatic = async function () {
    console.log('OK')
  }
})
