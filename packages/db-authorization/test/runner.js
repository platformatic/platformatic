'use strict'

const { spec: SpecReporter, tap } = require('node:test/reporters')
const { run } = require('node:test')
const process = require('node:process')
const { globSync } = require('glob')
const path = require('path')

const reporter = process.stdout.isTTY ? new SpecReporter() : tap

const files = [
  ...globSync(path.join(__dirname, '*.test.js'))
]

run({
  files,
  concurrency: 1,
  timeout: 30000
}).compose(reporter).pipe(process.stdout)
