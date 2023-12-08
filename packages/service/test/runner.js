'use strict'

const { tap, spec } = require('node:test/reporters')
const { run } = require('node:test')
const path = require('node:path')
const glob = require('glob').globSync

/* eslint-disable new-cap */
const reporter = process.stdout.isTTY ? new spec() : tap

const files = [
  ...glob(path.join(__dirname, '*.test.js')),
  ...glob(path.join(__dirname, 'cli', '*.test.mjs'))
]

const stream = run({
  files,
  concurrency: 1,
  timeout: 60000
})

stream.on('test:fail', () => {
  process.exitCode = 1
})

stream.compose(reporter).pipe(process.stdout)
