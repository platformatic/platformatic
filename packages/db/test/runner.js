'use strict'

const { spawn } = require('node:child_process')
const glob = require('glob')

const testFiles = glob.sync('test/*/*.test.{js,mjs}')

spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env }
})
  .on('exit', process.exit)
