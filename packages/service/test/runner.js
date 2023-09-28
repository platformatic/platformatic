'use strict'

const { spawn } = require('node:child_process')
const glob = require('glob')

const testFiles = glob.sync('test/**/*compile-{2,3,4,5}*.test.{js,mjs}')

spawn(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' })
  .on('exit', process.exit)
