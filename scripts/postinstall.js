'use strict'
const { exec } = require('child_process')

if (!process.env.CI) {
  console.log('Running dashboard:build script')
  const child = exec('pnpm run dashboard:build')
  child.stdout.pipe(process.stdout)
}
