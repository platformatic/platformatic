'use strict'
const { exec } = require('child_process')

if (!process.env.CI) {
  console.log('Running ra-data-rest build script')
  exec('pnpm run ra-data-rest build').stdout.pipe(process.stdout)

}
